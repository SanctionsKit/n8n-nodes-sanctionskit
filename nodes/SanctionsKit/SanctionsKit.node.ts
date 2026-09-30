import { NodeApiError, NodeConnectionTypes, NodeOperationError, UserError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { properties } from './properties';
import {
	buildScreening,
	idempotencyKey,
	resourceId,
	screeningOutput,
	validateCredentials,
} from './validation';

function object(value: unknown, label: string): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new UserError(`SanctionsKit returned an invalid ${label}`);
	return value as IDataObject;
}

export class SanctionsKit implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SanctionsKit',
		name: 'sanctionsKit',
		icon: { light: 'file:sanctionskit.svg', dark: 'file:sanctionskit.svg' },
		group: ['transform'],
		version: 1,
		usableAsTool: true,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Screen subjects and retrieve sanctions screening evidence',
		defaults: { name: 'SanctionsKit' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'sanctionsKitApi', required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			try {
				const environment = validateCredentials(await this.getCredentials('sanctionsKitApi'));
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const request: IHttpRequestOptions = {
					method: 'GET',
					url: '',
					headers: { Accept: 'application/json' },
					json: true,
					timeout: 30000,
					disableFollowRedirect: true,
				};
				let path: string;
				if (resource === 'screening' && operation === 'create') {
					path = '/screenings';
					request.method = 'POST';
					request.body = buildScreening(
						{
							name: this.getNodeParameter('name', i),
							entityType: this.getNodeParameter('entityType', i),
							coverage: this.getNodeParameter('coverage', i),
							package: this.getNodeParameter('package', i, ''),
							sources: this.getNodeParameter('sources', i, ''),
							options: this.getNodeParameter('options', i, {}),
						},
						environment,
					);
					request.headers = {
						...request.headers,
						'Content-Type': 'application/json',
						'Idempotency-Key': idempotencyKey(this.getNodeParameter('idempotencyKey', i)),
					};
				} else if (resource === 'screening' && ['get', 'getEvidence'].includes(operation)) {
					path = `/results/${resourceId(this.getNodeParameter('screeningId', i))}${operation === 'getEvidence' ? '/evidence' : ''}`;
				} else if (resource === 'source' && operation === 'getMany') path = '/sources';
				else if (resource === 'policy' && operation === 'getPage') {
					path = '/policies';
					const limit = Number(this.getNodeParameter('pageSize', i, 100));
					if (!Number.isInteger(limit) || limit < 1 || limit > 100)
						throw new UserError('Page size must be an integer from 1 to 100');
					const cursor = this.getNodeParameter('cursor', i, '') as string;
					request.qs = { limit, ...(cursor ? { cursor: resourceId(cursor, 'Cursor') } : {}) };
				} else throw new UserError('Select a supported resource and operation');
				request.url = `https://www.sanctionskit.com/api/v1${path}`;
				let response: IDataObject;
				try {
					response = object(
						await this.helpers.httpRequestWithAuthentication.call(this, 'sanctionsKitApi', request),
						'response',
					);
				} catch (error) {
					const status = Number(error?.statusCode ?? error?.response?.status ?? error?.httpCode);
					const code = error?.response?.data?.error?.code ?? error?.error?.error?.code;
					const safeCode =
						typeof code === 'string' && /^[a-z_]{1,80}$/.test(code) ? code : undefined;
					throw new NodeApiError(
						this.getNode(),
						{
							message: 'SanctionsKit request failed',
							...(Number.isInteger(status) && status >= 400 && status <= 599
								? { httpCode: String(status) }
								: {}),
						},
						{
							itemIndex: i,
							message: `SanctionsKit request failed${safeCode ? ` (${safeCode})` : ''}`,
							description:
								'Check API key permissions, selected coverage, approved policy and allowance. Retry a screening with the same idempotency key and unchanged input. Request inputs and credentials are omitted from this error.',
						},
					);
				}
				if (resource === 'screening') {
					if (operation === 'getEvidence') {
						if (response.format !== 'sanctionskit-evidence@1')
							throw new UserError('SanctionsKit returned an invalid evidence document');
						screeningOutput(response.result, environment, false);
						output.push({ json: response, pairedItem: { item: i } });
					} else {
						const isTool = this.getNode().type.endsWith('Tool');
						const mode = isTool ? (this.getNodeParameter('outputMode', i, 'raw') as string) : 'raw';
						if (!['raw', 'simplified', 'selected'].includes(mode))
							throw new UserError('Select a supported output mode');
						let result = screeningOutput(
							response.data,
							environment,
							isTool
								? mode === 'simplified'
								: (this.getNodeParameter('simplify', i, false) as boolean),
						);
						if (mode === 'selected') {
							const selected = this.getNodeParameter('outputFields', i, ['matches']) as string[];
							const allowed = [
								'createdAt',
								'matches',
								'matching',
								'policySnapshot',
								'reference',
								'subject',
							];
							if (!Array.isArray(selected) || selected.some((field) => !allowed.includes(field)))
								throw new UserError('Select supported output fields');
							const fields = new Set([
								'id',
								'environment',
								'status',
								'coverage',
								'versions',
								'disclaimer',
								...selected,
							]);
							result = Object.fromEntries(
								Object.entries(result).filter(([key]) => fields.has(key)),
							);
						}
						output.push({ json: result, pairedItem: { item: i } });
					}
				} else if (resource === 'source') {
					if (!Array.isArray(response.data))
						throw new UserError('SanctionsKit returned an invalid source list');
					const returnAll = this.getNodeParameter('returnAll', i, true) as boolean;
					const limit = returnAll
						? response.data.length
						: Number(this.getNodeParameter('limit', i, 50));
					if (!returnAll && (!Number.isInteger(limit) || limit < 1))
						throw new UserError('Limit must be a positive integer');
					for (const source of response.data.slice(0, limit))
						output.push({ json: object(source, 'source'), pairedItem: { item: i } });
				} else {
					const page = object(response.data, 'policy page');
					if (
						!Array.isArray(page.items) ||
						typeof page.requirePolicy !== 'boolean' ||
						!(page.nextCursor === null || typeof page.nextCursor === 'string')
					)
						throw new UserError('SanctionsKit returned an incomplete policy page');
					output.push({ json: page, pairedItem: { item: i } });
				}
			} catch (error) {
				const nodeError =
					error instanceof NodeApiError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				if (!this.continueOnFail()) throw nodeError;
				output.push({ json: { error: nodeError.message }, pairedItem: { item: i } });
			}
		}
		return [output];
	}
}

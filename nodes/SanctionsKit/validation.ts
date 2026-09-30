import { UserError, jsonParse } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';

export function textField(value: unknown, label: string, min: number, max: number): string {
	if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
		throw new UserError(`${label} must contain ${min}–${max} characters`);
	}
	return value.trim();
}

export function validateCredentials(credentials: IDataObject): 'sandbox' | 'production' {
	const environment = credentials.environment;
	if (environment !== 'sandbox' && environment !== 'production')
		throw new UserError('Select a credential environment');
	const prefix = environment === 'sandbox' ? 'sk_test_' : 'sk_live_';
	if (typeof credentials.apiKey !== 'string' || !credentials.apiKey.startsWith(prefix)) {
		throw new UserError('API key does not match the selected credential environment');
	}
	return environment;
}

export function resourceId(value: unknown, label = 'Screening ID'): string {
	const id = textField(value, label, 36, 36);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
		throw new UserError(`${label} must be a UUID`);
	return id;
}

export function idempotencyKey(value: unknown): string {
	if (typeof value !== 'string' || !/^[\w:.-]{8,128}$/.test(value))
		throw new UserError(
			'Idempotency key must be 8–128 letters, digits, underscores, colons, periods or hyphens',
		);
	return value;
}

export function buildScreening(
	parameters: IDataObject,
	environment: 'sandbox' | 'production',
): IDataObject {
	const subject: IDataObject = {
		name: textField(parameters.name, 'Name', 2, 300),
		entityType: parameters.entityType,
	};
	if (
		!['person', 'organization', 'vessel', 'aircraft', 'other'].includes(
			subject.entityType as string,
		)
	)
		throw new UserError('Select a supported entity type');
	const options = (parameters.options ?? {}) as IDataObject;
	if (options.country) subject.country = textField(options.country, 'Country', 2, 100);
	if (options.birthDate) {
		const date = textField(options.birthDate, 'Date of birth', 4, 10);
		if (!/^(?!0000)\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/.test(date))
			throw new UserError('Date of birth must use YYYY, YYYY-MM or YYYY-MM-DD');
		if (date.length === 10 && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
			throw new UserError('Date of birth must be a valid calendar date');
		subject.birthDate = date;
	}
	if (options.identifiers) {
		const identifiers: unknown =
			typeof options.identifiers === 'string'
				? jsonParse(options.identifiers, { errorMessage: 'Identifiers must be a JSON array' })
				: options.identifiers;
		if (!Array.isArray(identifiers) || identifiers.length > 20)
			throw new UserError('Identifiers must be an array containing at most 20 entries');
		subject.identifiers = identifiers.map((entry: unknown) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry))
				throw new UserError('Each identifier must contain a type and value');
			const item = entry as IDataObject;
			if (Object.keys(item).some((key) => !['type', 'value', 'issuer'].includes(key)))
				throw new UserError('Identifiers support only type, value and issuer');
			return {
				type: textField(item.type, 'Identifier type', 1, 80),
				value: textField(item.value, 'Identifier value', 1, 160),
				...(item.issuer === undefined
					? {}
					: { issuer: textField(item.issuer, 'Identifier issuer', 1, 100) }),
			};
		});
	}
	const body: IDataObject = { subject, retention: options.retention ?? 'standard' };
	if (!['standard', 'minimal'].includes(body.retention as string))
		throw new UserError('Select a supported retention option');
	const coverage = parameters.coverage;
	if (environment === 'sandbox') {
		if (coverage !== 'sandbox')
			throw new UserError('Sandbox credentials require synthetic sandbox coverage');
		body.package = 'sandbox@1';
	} else if (coverage === 'sources') {
		const sources = textField(parameters.sources, 'Source IDs', 1, 41471)
			.split(',')
			.map((source) => textField(source, 'Source ID', 1, 80));
		if (sources.length > 512 || new Set(sources).size !== sources.length)
			throw new UserError('Select 1–512 distinct source IDs');
		body.sources = sources;
	} else if (coverage === 'package') {
		body.package = textField(parameters.package, 'Coverage package', 1, 80);
		if (body.package === 'sandbox@1')
			throw new UserError('Production credentials cannot use the synthetic sandbox package');
	} else
		throw new UserError('Production screening requires an explicit coverage package or source IDs');
	if (options.reference) body.reference = textField(options.reference, 'Reference', 1, 160);
	if (options.counterpartyId)
		body.counterpartyId = resourceId(options.counterpartyId, 'Counterparty ID');
	if (options.policyId || options.policyVersion) {
		const version = Number(options.policyVersion);
		if (!Number.isSafeInteger(version) || version < 1)
			throw new UserError('Policy version must be a positive integer');
		body.policy = { id: resourceId(options.policyId, 'Policy ID'), version };
	}
	return body;
}

export function screeningOutput(
	data: unknown,
	environment: string,
	simplify: boolean,
): IDataObject {
	if (!data || typeof data !== 'object' || Array.isArray(data))
		throw new UserError('SanctionsKit returned an invalid screening response');
	const value = data as IDataObject;
	if (
		value.environment !== environment ||
		!['potential_match', 'no_match'].includes(value.status as string) ||
		!Array.isArray(value.matches) ||
		!Array.isArray(value.coverage) ||
		!value.versions ||
		typeof value.disclaimer !== 'string' ||
		typeof value.id !== 'string' ||
		typeof value.createdAt !== 'string'
	)
		throw new UserError(
			'SanctionsKit returned incomplete screening evidence or a different environment',
		);
	if (
		(value.status === 'no_match' && value.matches.length !== 0) ||
		(value.status === 'potential_match' && value.matches.length === 0)
	)
		throw new UserError('SanctionsKit returned inconsistent screening status and candidates');
	if (!simplify) return value;
	return Object.fromEntries(
		[
			'id',
			'environment',
			'status',
			'createdAt',
			'matches',
			'coverage',
			'versions',
			'disclaimer',
			'matching',
			'policySnapshot',
		]
			.filter((key) => value[key] !== undefined)
			.map((key) => [key, value[key]]),
	);
}

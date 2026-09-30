import type { INodeProperties } from 'n8n-workflow';

const createOnly = { show: { resource: ['screening'], operation: ['create'] } };

export const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Policy', value: 'policy' },
			{ name: 'Screening', value: 'screening' },
			{ name: 'Source', value: 'source' },
		],
		default: 'screening',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['screening'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Screen one subject against explicitly selected coverage',
				action: 'Create screening',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a retained screening result',
				action: 'Get screening',
			},
			{
				name: 'Get Evidence',
				value: 'getEvidence',
				description: 'Retrieve the complete retained screening evidence document',
				action: 'Get screening evidence',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['source'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Retrieve source availability, rights status and freshness',
				action: 'Get many sources',
			},
		],
		default: 'getMany',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['policy'] } },
		options: [
			{
				name: 'Get Page',
				value: 'getPage',
				description: 'Retrieve approved policies, the policy requirement and next cursor',
				action: 'Get policy page',
			},
		],
		default: 'getPage',
	},
	{
		displayName:
			'Sandbox uses synthetic records. Production screening is paid. Potential matches require review; no-match is limited to selected coverage and is not legal clearance.',
		name: 'screeningNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['screening'] } },
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. Alex Example',
		description: 'Fullest reliable name of the subject',
		displayOptions: createOnly,
	},
	{
		displayName: 'Entity Type',
		name: 'entityType',
		type: 'options',
		options: [
			{ name: 'Aircraft', value: 'aircraft' },
			{ name: 'Organization', value: 'organization' },
			{ name: 'Other', value: 'other' },
			{ name: 'Person', value: 'person' },
			{ name: 'Vessel', value: 'vessel' },
		],
		default: 'person',
		displayOptions: createOnly,
	},
	{
		displayName: 'Coverage',
		name: 'coverage',
		type: 'options',
		options: [
			{ name: 'Synthetic Sandbox', value: 'sandbox' },
			{ name: 'Production Package', value: 'package' },
			{ name: 'Production Source IDs', value: 'sources' },
		],
		default: 'sandbox',
		description:
			'Must match your credential environment. Production coverage must be available to your organization.',
		displayOptions: createOnly,
	},
	{
		displayName: 'Coverage Package',
		name: 'package',
		type: 'string',
		required: true,
		default: '',
		description: 'Exact versioned package available to your production organization',
		displayOptions: {
			show: { resource: ['screening'], operation: ['create'], coverage: ['package'] },
		},
	},
	{
		displayName: 'Source IDs',
		name: 'sources',
		type: 'string',
		required: true,
		default: '',
		description:
			'Comma-separated source IDs from Source: Get Many. Every source must be available, fresh and support the entity type.',
		displayOptions: {
			show: { resource: ['screening'], operation: ['create'], coverage: ['sources'] },
		},
	},
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. onboarding:customer123:v1',
		description:
			'Reuse the same key and body for retries. Use a different key for each distinct screening. 8–128 letters, digits, underscores, colons, periods or hyphens.',
		displayOptions: createOnly,
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: createOnly,
		options: [
			{
				displayName: 'Counterparty ID',
				name: 'counterpartyId',
				type: 'string',
				default: '',
				description:
					'Existing counterparty UUID in the same environment. Submitted identity must match.',
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'string',
				default: '',
				description:
					'Known country name or code used as identity evidence; does not select geographic coverage',
			},
			{
				displayName: 'Date of Birth',
				name: 'birthDate',
				type: 'string',
				default: '',
				placeholder: 'e.g. 1980-06',
				description:
					'Known date or partial date as YYYY, YYYY-MM or YYYY-MM-DD. Preserve known precision.',
			},
			{
				displayName: 'Identifiers',
				name: 'identifiers',
				type: 'json',
				default: '[]',
				description:
					'Up to 20 objects with type, value and optional issuer. Omit unknown identifiers.',
			},
			{
				displayName: 'Policy ID',
				name: 'policyId',
				type: 'string',
				default: '',
				description:
					'Approved policy UUID. Also supply Policy Version. Required when Policy: Get Page returns requirePolicy=true.',
			},
			{
				displayName: 'Policy Version',
				name: 'policyVersion',
				type: 'number',
				typeOptions: { minValue: 1, numberPrecision: 0 },
				default: 1,
				description: 'Exact approved version of the selected policy',
			},
			{
				displayName: 'Reference',
				name: 'reference',
				type: 'string',
				default: '',
				description: 'Your internal reference, up to 160 characters',
			},
			{
				displayName: 'Retention',
				name: 'retention',
				type: 'options',
				options: [
					{
						name: 'Standard',
						value: 'standard',
						description: 'Retain inputs and evidence under organization and case policy',
					},
					{
						name: 'Minimal',
						value: 'minimal',
						description:
							'24-hour retention without submitted inputs; unavailable when governance requires standard retention',
					},
				],
				default: 'standard',
			},
		],
	},
	{
		displayName: 'Screening ID',
		name: 'screeningId',
		type: 'string',
		required: true,
		default: '',
		description: 'UUID returned by Create Screening',
		displayOptions: { show: { resource: ['screening'], operation: ['get', 'getEvidence'] } },
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: false,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		hint: 'Simplified results retain candidates, coverage, versions, matching policy and interpretation limits; retained inputs are omitted.',
		displayOptions: {
			show: { resource: ['screening'], operation: ['create', 'get'], '@tool': [false] },
		},
	},
	{
		displayName: 'Output',
		name: 'outputMode',
		type: 'options',
		default: 'raw',
		options: [
			{ name: 'Raw', value: 'raw', description: 'All returned screening fields' },
			{
				name: 'Simplified',
				value: 'simplified',
				description: 'Screening decision context without retained inputs',
			},
			{
				name: 'Selected Fields',
				value: 'selected',
				description:
					'Selected fields plus ID, environment, status, coverage, versions and interpretation limits',
			},
		],
		displayOptions: {
			show: { resource: ['screening'], operation: ['create', 'get'], '@tool': [true] },
		},
	},
	{
		displayName: 'Fields',
		name: 'outputFields',
		type: 'multiOptions',
		default: ['matches'],
		description:
			'Extra fields to return. ID, environment, status, coverage, versions and interpretation limits are always included.',
		options: [
			{ name: 'Created At', value: 'createdAt' },
			{ name: 'Matches', value: 'matches' },
			{ name: 'Matching', value: 'matching' },
			{ name: 'Policy Snapshot', value: 'policySnapshot' },
			{ name: 'Reference', value: 'reference' },
			{ name: 'Subject', value: 'subject' },
		],
		displayOptions: {
			show: {
				resource: ['screening'],
				operation: ['create', 'get'],
				outputMode: ['selected'],
				'@tool': [true],
			},
		},
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['source'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, numberPrecision: 0 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['source'], returnAll: [false] } },
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
		default: 100,
		description: 'Maximum number of policies in this page',
		displayOptions: { show: { resource: ['policy'] } },
	},
	{
		displayName: 'Cursor',
		name: 'cursor',
		type: 'string',
		default: '',
		description: 'Previous policy response nextCursor. Leave empty for the first page.',
		displayOptions: { show: { resource: ['policy'] } },
	},
];

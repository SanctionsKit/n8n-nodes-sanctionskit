import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SanctionsKitApi implements ICredentialType {
	name = 'sanctionsKitApi';
	displayName = 'SanctionsKit API';
	documentationUrl = 'https://www.sanctionskit.com/docs/quickstart';
	icon = 'file:../nodes/SanctionsKit/sanctionskit.svg' as const;
	httpRequestNode = {
		name: 'SanctionsKit',
		docsUrl: 'https://www.sanctionskit.com/docs',
		apiBaseUrlPlaceholder: 'https://www.sanctionskit.com/api/v1',
	};
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'Create an API key in your SanctionsKit dashboard',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{ name: 'Sandbox (Synthetic Data)', value: 'sandbox' },
				{ name: 'Production (Paid Screening)', value: 'production' },
			],
			default: 'sandbox',
			description:
				'Must match the API key environment. Sandbox uses synthetic records and is never billed.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://www.sanctionskit.com/api/v1',
			url: '/sources',
			method: 'GET',
			disableFollowRedirect: true,
			timeout: 30000,
			headers: { Accept: 'application/json' },
		},
	};
}

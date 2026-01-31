import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterLLM implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter LLM',
		name: 'docRouterLLM',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Run and manage LLM analysis on documents in DocRouter.ai',
		defaults: {
			name: 'DocRouter LLM',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'docRouterOrgApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run',
						value: 'run',
						description: 'Run LLM analysis on a document',
						action: 'Run LLM analysis',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get LLM result for a document',
						action: 'Get LLM result',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update LLM result (edits and verification)',
						action: 'Update LLM result',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete LLM result for a document and prompt',
						action: 'Delete LLM result',
					},
				],
				default: 'run',
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				description: 'The document ID',
			},
			{
				displayName: 'Prompt Revision ID',
				name: 'promptRevid',
				type: 'string',
				default: 'default',
				description:
					'The prompt revision ID (e.g. "default"). Required for Update and Delete.',
				displayOptions: {
					show: { operation: ['run', 'get', 'update', 'delete'] },
				},
			},
			{
				displayName: 'Force',
				name: 'force',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: { operation: ['run'] },
				},
				description: 'Force a new run even if a result already exists',
			},
			{
				displayName: 'Fallback',
				name: 'fallback',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: { operation: ['get'] },
				},
				description: 'Fallback to the most recent available prompt revision result',
			},
			{
				displayName: 'Updated LLM Result',
				name: 'updatedLlmResult',
				type: 'json',
				default: '{}',
				required: true,
				displayOptions: {
					show: { operation: ['update'] },
				},
				description: 'The updated LLM result object (user edits)',
			},
			{
				displayName: 'Is Verified',
				name: 'isVerified',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: { operation: ['update'] },
				},
				description: 'Mark the result as verified',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('docRouterOrgApi');
		const baseUrl =
			(credentials?.baseUrl as string)?.trim() || 'https://app.docrouter.ai/fastapi';
		const apiToken = credentials?.apiToken as string;

		const tokenInfoResponse = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'docRouterOrgApi',
			{
				method: 'GET',
				baseURL: baseUrl,
				url: '/v0/account/token/organization',
				qs: { token: apiToken },
				json: true,
			},
		)) as IDataObject;

		const organizationId = tokenInfoResponse?.organization_id as string;
		if (!organizationId) {
			throw new NodeOperationError(
				this.getNode(),
				'Could not determine organization ID from token. Use an organization-level API token.',
			);
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const documentId = this.getNodeParameter('documentId', itemIndex) as string;
				const promptRevid = this.getNodeParameter('promptRevid', itemIndex, 'default') as string;

				let response: IDataObject;

				switch (operation) {
					case 'run': {
						const force = this.getNodeParameter('force', itemIndex, false) as boolean;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/llm/run/${documentId}`,
								qs: { prompt_revid: promptRevid || 'default', force },
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'get': {
						const fallback = this.getNodeParameter('fallback', itemIndex, false) as boolean;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'GET',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/llm/result/${documentId}`,
								qs: {
									prompt_revid: promptRevid || 'default',
									fallback,
								},
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'update': {
						const updatedLlmResultParam = this.getNodeParameter(
							'updatedLlmResult',
							itemIndex,
						) as string | IDataObject;
						const isVerified = this.getNodeParameter('isVerified', itemIndex, false) as boolean;

						const updatedLlmResult =
							typeof updatedLlmResultParam === 'string'
								? (JSON.parse(updatedLlmResultParam || '{}') as IDataObject)
								: (updatedLlmResultParam as IDataObject);

						if (!promptRevid?.trim()) {
							throw new NodeOperationError(
								this.getNode(),
								'Prompt Revision ID is required for Update.',
								{ itemIndex },
							);
						}

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/llm/result/${documentId}`,
								qs: { prompt_revid: promptRevid.trim() },
								body: {
									updated_llm_result: updatedLlmResult,
									is_verified: isVerified,
								},
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'delete': {
						if (!promptRevid?.trim()) {
							throw new NodeOperationError(
								this.getNode(),
								'Prompt Revision ID is required for Delete.',
								{ itemIndex },
							);
						}
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterOrgApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/llm/result/${documentId}`,
							qs: { prompt_revid: promptRevid.trim() },
							json: true,
						});
						response = { success: true, documentId, promptRevid: promptRevid.trim() };
						break;
					}

					default:
						if (operation === '__CUSTOM_API_CALL__') {
							throw new NodeOperationError(
								this.getNode(),
								'For custom API calls, use the HTTP Request node and choose "DocRouter Organization API" under Authentication → Predefined Credential Type. This node only supports Run, Get, Update, and Delete.',
							);
						}
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: (response ?? {}) as IDataObject,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: itemIndex },
						error:
							error instanceof NodeOperationError
								? error
								: new NodeOperationError(this.getNode(), error as Error),
					});
				} else {
					if (error instanceof Error && 'context' in error) {
						(error as NodeOperationError).context = {
							...(error as NodeOperationError).context,
							itemIndex,
						};
					}
					throw error;
				}
			}
		}

		return [returnData];
	}
}

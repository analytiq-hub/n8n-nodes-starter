import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterTag implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter Tag',
		name: 'docRouterTag',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage tags in DocRouter.ai',
		defaults: {
			name: 'DocRouter Tag',
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
						name: 'List',
						value: 'list',
						description: 'List tags in the organization',
						action: 'List tags',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a tag by ID',
						action: 'Get a tag',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a tag',
						action: 'Create a tag',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a tag',
						action: 'Update a tag',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a tag',
						action: 'Delete a tag',
					},
				],
				default: 'list',
			},
			// ===== List parameters =====
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { min: 1, max: 100 },
				default: 10,
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Maximum number of tags to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Number of tags to skip (pagination)',
			},
			{
				displayName: 'Name Search',
				name: 'nameSearch',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Search term for tag names',
			},
			// ===== Get / Update / Delete: tag ID =====
			{
				displayName: 'Tag ID',
				name: 'tagId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { operation: ['get', 'update', 'delete'] },
				},
				description: 'The tag ID',
			},
			// ===== Create / Update: tag config =====
			{
				displayName: 'Name',
				name: 'tagName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { operation: ['create', 'update'] },
				},
				description: 'Tag name',
			},
			{
				displayName: 'Color',
				name: 'color',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['create', 'update'] },
				},
				description: 'Optional color for the tag (e.g. hex or CSS color name)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['create', 'update'] },
				},
				description: 'Optional description for the tag',
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

		if (operation === 'list') {
			try {
				const limit = this.getNodeParameter('limit', 0, 10) as number;
				const skip = this.getNodeParameter('skip', 0, 0) as number;
				const nameSearch = this.getNodeParameter('nameSearch', 0, '') as string;

				const qs: IDataObject = { limit, skip };
				if (nameSearch?.trim()) qs.name_search = nameSearch.trim();

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'docRouterOrgApi',
					{
						method: 'GET',
						baseURL: baseUrl,
						url: `/v0/orgs/${organizationId}/tags`,
						qs,
						json: true,
					},
				);

				returnData.push({
					json: (response ?? {}) as IDataObject,
					pairedItem: { item: 0 },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message } as IDataObject,
						pairedItem: { item: 0 },
						error:
							error instanceof NodeOperationError
								? error
								: new NodeOperationError(this.getNode(), error as Error),
					});
				} else {
					throw error;
				}
			}
			return [returnData];
		}

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let response: IDataObject;

				switch (operation) {
					case 'get': {
						const tagId = this.getNodeParameter('tagId', itemIndex) as string;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'GET',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/tags/${tagId}`,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'create': {
						const tagName = this.getNodeParameter('tagName', itemIndex) as string;
						const color = this.getNodeParameter('color', itemIndex, '') as string;
						const description = this.getNodeParameter('description', itemIndex, '') as string;

						const body: IDataObject = { name: tagName.trim() };
						if (typeof color === 'string' && color.trim()) body.color = color.trim();
						if (typeof description === 'string' && description.trim())
							body.description = description.trim();

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/tags`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'update': {
						const tagId = this.getNodeParameter('tagId', itemIndex) as string;
						const tagName = this.getNodeParameter('tagName', itemIndex) as string;
						const color = this.getNodeParameter('color', itemIndex, '') as string;
						const description = this.getNodeParameter('description', itemIndex, '') as string;

						const body: IDataObject = { name: tagName.trim() };
						if (typeof color === 'string' && color.trim()) body.color = color.trim();
						if (typeof description === 'string' && description.trim())
							body.description = description.trim();

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/tags/${tagId}`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'delete': {
						const tagId = this.getNodeParameter('tagId', itemIndex) as string;
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterOrgApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/tags/${tagId}`,
							json: true,
						});
						response = { success: true, tagId } as IDataObject;
						break;
					}

					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: response ?? {},
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

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterDocument implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter Document',
		name: 'docRouterDocument',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage documents in DocRouter.ai',
		defaults: {
			name: 'DocRouter Document',
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
						name: 'Upload',
						value: 'upload',
						description: 'Upload a document',
						action: 'Upload a document',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List documents in the organization',
						action: 'List documents',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a document by ID',
						action: 'Get a document',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a document',
						action: 'Update a document',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a document',
						action: 'Delete a document',
					},
				],
				default: 'upload',
			},
			// ===== Upload parameters =====
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: { operation: ['upload'] },
				},
				description:
					'Name of the binary property containing the file data (e.g. "data" from a previous node).',
			},
			{
				displayName: 'Document Name',
				name: 'documentName',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['upload'] },
				},
				description:
					'File name for the document. Leave empty to use the binary property file name.',
			},
			{
				displayName: 'Tag IDs',
				name: 'tagIds',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['upload', 'update'] },
				},
				description: 'Comma-separated tag IDs to associate with the document.',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: { operation: ['upload', 'update'] },
				},
				description: 'Optional key-value metadata for the document.',
			},
			// ===== List parameters =====
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Maximum number of documents to return (1-100).',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Number of documents to skip (for pagination).',
			},
			{
				displayName: 'Filter by Tag IDs',
				name: 'filterTagIds',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Comma-separated tag IDs to filter documents.',
			},
			{
				displayName: 'Name Search',
				name: 'nameSearch',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['list'] },
				},
				description: 'Search term for document names.',
			},
			{
				displayName: 'Metadata Search',
				name: 'metadataSearch',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['list'] },
				},
				description:
					'Metadata search as key=value pairs, comma-separated (e.g., "author=John,type=invoice").',
			},
			// ===== Get/Update/Delete parameters =====
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { operation: ['get', 'update', 'delete'] },
				},
				description: 'The ID of the document.',
			},
			// ===== Get parameters =====
			{
				displayName: 'File Type',
				name: 'fileType',
				type: 'options',
				options: [
					{ name: 'Original', value: 'original' },
					{ name: 'PDF', value: 'pdf' },
				],
				default: 'original',
				displayOptions: {
					show: { operation: ['get'] },
				},
				description: 'Which file to retrieve: original or PDF version.',
			},
			// ===== Update parameters =====
			{
				displayName: 'New Document Name',
				name: 'newDocumentName',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['update'] },
				},
				description: 'New name for the document (leave empty to keep current).',
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

		// Get organization ID from the token
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
				'Could not determine organization ID from token. Make sure you are using an organization-level API token.',
			);
		}

		// For list operation, execute once regardless of items
		if (operation === 'list') {
			try {
				const limit = this.getNodeParameter('limit', 0, 10) as number;
				const skip = this.getNodeParameter('skip', 0, 0) as number;
				const filterTagIds = this.getNodeParameter('filterTagIds', 0, '') as string;
				const nameSearch = this.getNodeParameter('nameSearch', 0, '') as string;
				const metadataSearch = this.getNodeParameter('metadataSearch', 0, '') as string;

				const qs: IDataObject = { limit, skip };
				if (filterTagIds) qs.tag_ids = filterTagIds;
				if (nameSearch) qs.name_search = nameSearch;
				if (metadataSearch) qs.metadata_search = metadataSearch;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'docRouterOrgApi',
					{
						method: 'GET',
						baseURL: baseUrl,
						url: `/v0/orgs/${organizationId}/documents`,
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

		// For other operations, iterate over items
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let response: IDataObject;

				switch (operation) {
					case 'upload': {
						const binaryPropertyName = this.getNodeParameter(
							'binaryPropertyName',
							itemIndex,
						) as string;
						const documentNameParam = this.getNodeParameter(
							'documentName',
							itemIndex,
							'',
						) as string;
						const tagIdsParam = this.getNodeParameter('tagIds', itemIndex, '') as string;
						const metadataParam = this.getNodeParameter('metadata', itemIndex, {}) as
							| string
							| object;

						const item = items[itemIndex];
						const binaryData = item.binary?.[binaryPropertyName];

						if (!binaryData) {
							throw new NodeOperationError(
								this.getNode(),
								`No binary data found on property "${binaryPropertyName}"`,
								{ itemIndex },
							);
						}

						const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
						const content = buffer.toString('base64');
						const documentName =
							documentNameParam?.trim() || (binaryData.fileName as string) || 'document';
						const tagIds = tagIdsParam
							? tagIdsParam
									.split(',')
									.map((id) => id.trim())
									.filter(Boolean)
							: [];
						const metadata =
							typeof metadataParam === 'string'
								? (JSON.parse(metadataParam || '{}') as Record<string, string>)
								: (metadataParam as Record<string, string>);

						const body = {
							documents: [
								{
									name: documentName,
									content,
									tag_ids: tagIds.length ? tagIds : undefined,
									metadata: Object.keys(metadata || {}).length ? metadata : undefined,
								},
							],
						};

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/documents`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'get': {
						const documentId = this.getNodeParameter('documentId', itemIndex) as string;
						const fileType = this.getNodeParameter('fileType', itemIndex, 'original') as string;

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'GET',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/documents/${documentId}`,
								qs: { file_type: fileType },
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'update': {
						const documentId = this.getNodeParameter('documentId', itemIndex) as string;
						const newDocumentName = this.getNodeParameter(
							'newDocumentName',
							itemIndex,
							'',
						) as string;
						const tagIdsParam = this.getNodeParameter('tagIds', itemIndex, '') as string;
						const metadataParam = this.getNodeParameter('metadata', itemIndex, {}) as
							| string
							| object;

						const body: IDataObject = {};
						if (newDocumentName) body.document_name = newDocumentName;
						if (tagIdsParam) {
							body.tag_ids = tagIdsParam
								.split(',')
								.map((id) => id.trim())
								.filter(Boolean);
						}
						if (metadataParam) {
							const metadata =
								typeof metadataParam === 'string'
									? (JSON.parse(metadataParam || '{}') as Record<string, string>)
									: (metadataParam as Record<string, string>);
							if (Object.keys(metadata).length > 0) {
								body.metadata = metadata;
							}
						}

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/documents/${documentId}`,
								body,
								json: true,
							},
						)) as IDataObject;
						response = response ?? { success: true };
						break;
					}

					case 'delete': {
						const documentId = this.getNodeParameter('documentId', itemIndex) as string;

						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterOrgApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/documents/${documentId}`,
							json: true,
						});

						response = { success: true, documentId } as IDataObject;
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

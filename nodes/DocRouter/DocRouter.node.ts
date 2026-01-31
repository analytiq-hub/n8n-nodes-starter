import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter',
		name: 'docRouter',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Upload documents to DocRouter.ai',
		defaults: {
			name: 'DocRouter',
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
		requestDefaults: {
			baseURL: 'https://app.docrouter.ai/fastapi',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Upload Document',
						value: 'upload',
						description: 'Upload one or more documents to an organization',
						action: 'Upload a document',
					},
				],
				default: 'upload',
			},
			{
				displayName: 'Organization ID',
				name: 'organizationId',
				type: 'string',
				default: '',
				required: true,
				description: 'The DocRouter organization ID to upload documents to',
				displayOptions: {
					show: { operation: ['upload'] },
				},
			},
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
					'Name of the binary property containing the file data (e.g. "data" from a previous node)',
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
					'File name for the document. Leave empty to use the binary property file name, or use an expression like {{ $binary.data.fileName }}.',
			},
			{
				displayName: 'Tag IDs',
				name: 'tagIds',
				type: 'string',
				default: '',
				displayOptions: {
					show: { operation: ['upload'] },
				},
				description: 'Comma-separated tag IDs to associate with the document(s)',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'json',
				default: '{}',
				displayOptions: {
					show: { operation: ['upload'] },
				},
				description: 'Optional key-value metadata for the document(s)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		if (operation !== 'upload') {
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
		}

		const organizationId = this.getNodeParameter('organizationId', 0) as string;
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 0) as string;
		const documentNameParam = this.getNodeParameter('documentName', 0, '') as string;
		const tagIdsParam = this.getNodeParameter('tagIds', 0, '') as string;
		const metadataParam = this.getNodeParameter('metadata', 0, {}) as string | object;

		const credentials = await this.getCredentials('docRouterOrgApi');
		const baseUrl =
			(credentials?.baseUrl as string)?.trim() || 'https://app.docrouter.ai/fastapi';

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];
				const binaryData = item.binary?.[binaryPropertyName];

				if (!binaryData) {
					throw new NodeOperationError(this.getNode(), `No binary data found on property "${binaryPropertyName}"`, {
						itemIndex,
					});
				}

				const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
				const content = buffer.toString('base64');
				const documentName =
					documentNameParam?.trim() || (binaryData.fileName as string) || 'document';
				const tagIds = tagIdsParam
					? tagIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
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

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'docRouterOrgApi',
					{
						method: 'POST',
						baseURL: baseUrl,
						url: `/v0/orgs/${organizationId}/documents`,
						body,
						json: true,
					},
				);

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

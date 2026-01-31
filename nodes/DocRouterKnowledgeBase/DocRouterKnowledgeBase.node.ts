import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterKnowledgeBase implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter Knowledge Base',
		name: 'docRouterKnowledgeBase',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage knowledge bases and run search/chat in DocRouter.ai',
		defaults: {
			name: 'DocRouter Knowledge Base',
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
					{ name: 'List', value: 'list', description: 'List knowledge bases', action: 'List knowledge bases' },
					{ name: 'Get', value: 'get', description: 'Get a knowledge base by ID', action: 'Get a knowledge base' },
					{ name: 'Create', value: 'create', description: 'Create a knowledge base', action: 'Create a knowledge base' },
					{ name: 'Update', value: 'update', description: 'Update a knowledge base', action: 'Update a knowledge base' },
					{ name: 'Delete', value: 'delete', description: 'Delete a knowledge base', action: 'Delete a knowledge base' },
					{ name: 'List Documents', value: 'listDocuments', description: 'List documents in a KB', action: 'List KB documents' },
					{ name: 'List Chunks', value: 'listChunks', description: 'List chunks for a document in a KB', action: 'List document chunks' },
					{ name: 'Search', value: 'search', description: 'Vector search in a knowledge base', action: 'Search knowledge base' },
					{ name: 'Chat', value: 'chat', description: 'Chat with a knowledge base (LLM)', action: 'Chat with knowledge base' },
					{ name: 'Reconcile', value: 'reconcile', description: 'Reconcile one knowledge base', action: 'Reconcile KB' },
					{ name: 'Reconcile All', value: 'reconcileAll', description: 'Reconcile all knowledge bases', action: 'Reconcile all KBs' },
				],
				default: 'list',
			},
			// ===== List =====
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { min: 1, max: 100 },
				default: 10,
				displayOptions: { show: { operation: ['list'] } },
				description: 'Maximum number of knowledge bases to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['list'] } },
				description: 'Number to skip (pagination)',
			},
			{
				displayName: 'Name Search',
				name: 'nameSearch',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['list'] } },
				description: 'Search term for KB names',
			},
			// ===== Get / Update / Delete / List Documents / List Chunks / Search / Chat / Reconcile =====
			{
				displayName: 'Knowledge Base ID',
				name: 'kbId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { operation: ['get', 'update', 'delete', 'listDocuments', 'listChunks', 'search', 'chat', 'reconcile'] },
				},
				description: 'The knowledge base ID',
			},
			// ===== List Documents / List Chunks =====
			{
				displayName: 'Limit',
				name: 'listLimit',
				type: 'number',
				typeOptions: { min: 1, max: 100 },
				default: 10,
				displayOptions: { show: { operation: ['listDocuments'] } },
				description: 'Maximum number of documents to return',
			},
			{
				displayName: 'Skip',
				name: 'listSkip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['listDocuments'] } },
				description: 'Number to skip (pagination)',
			},
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['listChunks'] } },
				description: 'The document ID in the knowledge base',
			},
			{
				displayName: 'Chunks Limit',
				name: 'chunksLimit',
				type: 'number',
				typeOptions: { min: 1, max: 1000 },
				default: 100,
				displayOptions: { show: { operation: ['listChunks'] } },
				description: 'Maximum number of chunks to return',
			},
			{
				displayName: 'Chunks Skip',
				name: 'chunksSkip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['listChunks'] } },
				description: 'Number to skip (pagination)',
			},
			// ===== Search =====
			{
				displayName: 'Query',
				name: 'searchQuery',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['search'] } },
				description: 'Search query text',
			},
			{
				displayName: 'Top K',
				name: 'topK',
				type: 'number',
				typeOptions: { min: 1, max: 20 },
				default: 5,
				displayOptions: { show: { operation: ['search'] } },
				description: 'Number of results to return',
			},
			{
				displayName: 'Search Skip',
				name: 'searchSkip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['search'] } },
				description: 'Pagination offset',
			},
			{
				displayName: 'Metadata Filter',
				name: 'metadataFilter',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['search'] } },
				description: 'Optional metadata filters (object)',
			},
			{
				displayName: 'Coalesce Neighbors',
				name: 'coalesceNeighborsSearch',
				type: 'number',
				typeOptions: { min: 0, max: 5 },
				default: undefined,
				displayOptions: { show: { operation: ['search'] } },
				description: 'Override KB default for neighboring chunks (0-5)',
			},
			// ===== Chat =====
			{
				displayName: 'Model',
				name: 'chatModel',
				type: 'string',
				default: 'gpt-4o-mini',
				required: true,
				displayOptions: { show: { operation: ['chat'] } },
				description: 'LLM model (e.g. gpt-4o-mini)',
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'json',
				default: '[{"role":"user","content":"Hello"}]',
				required: true,
				displayOptions: { show: { operation: ['chat'] } },
				description: 'Array of messages: { role: "user"|"assistant"|"system", content: string }',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				typeOptions: { min: 0, max: 2, step: 0.1 },
				default: 0.7,
				displayOptions: { show: { operation: ['chat'] } },
				description: 'Sampling temperature (0 to 2)',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				typeOptions: { min: 1 },
				default: undefined,
				displayOptions: { show: { operation: ['chat'] } },
				description: 'Maximum tokens to generate',
			},
			{
				displayName: 'Stream',
				name: 'stream',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['chat'] } },
				description: 'Whether to stream the response',
			},
			{
				displayName: 'Chat Metadata Filter',
				name: 'chatMetadataFilter',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['chat'] } },
				description: 'Optional metadata filters (object)',
			},
			// ===== Reconcile / Reconcile All =====
			{
				displayName: 'Dry Run',
				name: 'dryRun',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['reconcile', 'reconcileAll'] } },
				description: 'If true, only report issues without fixing',
			},
			// ===== Create / Update =====
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Human-readable name for the KB',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Optional description',
			},
			{
				displayName: 'Tag IDs',
				name: 'tagIds',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Comma-separated tag IDs for auto-indexing',
			},
			{
				displayName: 'Chunker Type',
				name: 'chunkerType',
				type: 'string',
				default: 'recursive',
				displayOptions: { show: { operation: ['create'] } },
				description: 'Chonkie chunker type',
			},
			{
				displayName: 'Chunk Size',
				name: 'chunkSize',
				type: 'number',
				typeOptions: { min: 1 },
				default: 512,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Target tokens per chunk',
			},
			{
				displayName: 'Chunk Overlap',
				name: 'chunkOverlap',
				type: 'number',
				typeOptions: { min: 0 },
				default: 128,
				displayOptions: { show: { operation: ['create'] } },
				description: 'Overlap tokens between chunks',
			},
			{
				displayName: 'Embedding Model',
				name: 'embeddingModel',
				type: 'string',
				default: 'text-embedding-3-small',
				displayOptions: { show: { operation: ['create'] } },
				description: 'LiteLLM embedding model',
			},
			{
				displayName: 'Coalesce Neighbors',
				name: 'coalesceNeighbors',
				type: 'number',
				typeOptions: { min: 0, max: 5 },
				default: 0,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Neighboring chunks to include (0-5)',
			},
			{
				displayName: 'Reconcile Enabled',
				name: 'reconcileEnabled',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Enable periodic automatic reconciliation',
			},
			{
				displayName: 'Reconcile Interval (seconds)',
				name: 'reconcileIntervalSeconds',
				type: 'number',
				typeOptions: { min: 60 },
				default: undefined,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Required if Reconcile Enabled is true (minimum 60)',
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

		const pushOne = (response: IDataObject, itemIndex: number) => {
			returnData.push({
				json: (response ?? {}) as IDataObject,
				pairedItem: { item: itemIndex },
			});
		};

		const handleError = (error: unknown, itemIndex: number) => {
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
				throw error;
			}
		};

		// Operations that run once (no per-item loop)
		if (
			['list', 'listDocuments', 'listChunks', 'search', 'chat', 'reconcile', 'reconcileAll'].includes(
				operation,
			)
		) {
			try {
				let response: IDataObject;

				if (operation === 'list') {
					const limit = this.getNodeParameter('limit', 0, 10) as number;
					const skip = this.getNodeParameter('skip', 0, 0) as number;
					const nameSearch = this.getNodeParameter('nameSearch', 0, '') as string;
					const qs: IDataObject = { limit, skip };
					if (nameSearch?.trim()) qs.name_search = nameSearch.trim();
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'GET',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases`,
							qs,
							json: true,
						},
					)) as IDataObject;
				} else if (operation === 'listDocuments') {
					const kbId = this.getNodeParameter('kbId', 0) as string;
					const listLimit = this.getNodeParameter('listLimit', 0, 10) as number;
					const listSkip = this.getNodeParameter('listSkip', 0, 0) as number;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'GET',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}/documents`,
							qs: { limit: listLimit, skip: listSkip },
							json: true,
						},
					)) as IDataObject;
				} else if (operation === 'listChunks') {
					const kbId = this.getNodeParameter('kbId', 0) as string;
					const documentId = this.getNodeParameter('documentId', 0) as string;
					const chunksLimit = this.getNodeParameter('chunksLimit', 0, 100) as number;
					const chunksSkip = this.getNodeParameter('chunksSkip', 0, 0) as number;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'GET',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}/documents/${documentId}/chunks`,
							qs: { limit: chunksLimit, skip: chunksSkip },
							json: true,
						},
					)) as IDataObject;
				} else if (operation === 'search') {
					const kbId = this.getNodeParameter('kbId', 0) as string;
					const searchQuery = this.getNodeParameter('searchQuery', 0) as string;
					const topK = this.getNodeParameter('topK', 0, 5) as number;
					const searchSkip = this.getNodeParameter('searchSkip', 0, 0) as number;
					const metadataFilterParam = this.getNodeParameter('metadataFilter', 0, '{}') as
						| string
						| IDataObject;
					const nodeParams = this.getNode().parameters as IDataObject;
					const coalesceNeighborsSearch =
						'coalesceNeighborsSearch' in nodeParams && nodeParams.coalesceNeighborsSearch != null
							? (nodeParams.coalesceNeighborsSearch as number)
							: undefined;
					const metadataFilter =
						typeof metadataFilterParam === 'string'
							? (JSON.parse(metadataFilterParam || '{}') as IDataObject)
							: (metadataFilterParam as IDataObject);
					const body: IDataObject = { query: searchQuery.trim(), top_k: topK, skip: searchSkip };
					if (Object.keys(metadataFilter).length > 0) body.metadata_filter = metadataFilter;
					if (coalesceNeighborsSearch != null) body.coalesce_neighbors = coalesceNeighborsSearch;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'POST',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}/search`,
							body,
							json: true,
						},
					)) as IDataObject;
				} else if (operation === 'chat') {
					const kbId = this.getNodeParameter('kbId', 0) as string;
					const chatModel = this.getNodeParameter('chatModel', 0) as string;
					const messagesParam = this.getNodeParameter('messages', 0) as string | IDataObject[];
					const temperature = this.getNodeParameter('temperature', 0, 0.7) as number;
					const nodeParamsChat = this.getNode().parameters as IDataObject;
					const maxTokens =
						'maxTokens' in nodeParamsChat && nodeParamsChat.maxTokens != null
							? (nodeParamsChat.maxTokens as number)
							: undefined;
					const stream = this.getNodeParameter('stream', 0, true) as boolean;
					const chatMetadataFilterParam = this.getNodeParameter('chatMetadataFilter', 0, '{}') as
						| string
						| IDataObject;
					const messages =
						typeof messagesParam === 'string'
							? (JSON.parse(messagesParam || '[]') as IDataObject[])
							: (messagesParam as IDataObject[]);
					const chatMetadataFilter =
						typeof chatMetadataFilterParam === 'string'
							? (JSON.parse(chatMetadataFilterParam || '{}') as IDataObject)
							: (chatMetadataFilterParam as IDataObject);
					const body: IDataObject = {
						model: chatModel.trim(),
						messages,
						temperature,
						stream,
					};
					if (maxTokens != null) body.max_tokens = maxTokens;
					if (Object.keys(chatMetadataFilter).length > 0)
						body.metadata_filter = chatMetadataFilter;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'POST',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}/chat`,
							body,
							json: true,
						},
					)) as IDataObject;
				} else if (operation === 'reconcile') {
					const kbId = this.getNodeParameter('kbId', 0) as string;
					const dryRun = this.getNodeParameter('dryRun', 0, false) as boolean;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'POST',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}/reconcile`,
							qs: { dry_run: dryRun },
							json: true,
						},
					)) as IDataObject;
				} else {
					// reconcileAll
					const dryRun = this.getNodeParameter('dryRun', 0, false) as boolean;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterOrgApi',
						{
							method: 'POST',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/reconcile-all`,
							qs: { dry_run: dryRun },
							json: true,
						},
					)) as IDataObject;
				}

				pushOne(response, 0);
			} catch (error) {
				handleError(error, 0);
			}
			return [returnData];
		}

		// Per-item: get, create, update, delete
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let response: IDataObject;

				switch (operation) {
					case 'get': {
						const kbId = this.getNodeParameter('kbId', itemIndex) as string;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'GET',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}`,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'create': {
						const name = this.getNodeParameter('name', itemIndex) as string;
						const description = this.getNodeParameter('description', itemIndex, '') as string;
						const tagIdsStr = this.getNodeParameter('tagIds', itemIndex, '') as string;
						const chunkerType = this.getNodeParameter('chunkerType', itemIndex, 'recursive') as string;
						const chunkSize = this.getNodeParameter('chunkSize', itemIndex, 512) as number;
						const chunkOverlap = this.getNodeParameter('chunkOverlap', itemIndex, 128) as number;
						const embeddingModel = this.getNodeParameter(
							'embeddingModel',
							itemIndex,
							'text-embedding-3-small',
						) as string;
						const coalesceNeighbors = this.getNodeParameter('coalesceNeighbors', itemIndex, 0) as number;
						const reconcileEnabled = this.getNodeParameter('reconcileEnabled', itemIndex, false) as boolean;
						const reconcileIntervalSeconds = this.getNodeParameter(
							'reconcileIntervalSeconds',
							itemIndex,
							undefined,
						) as number | undefined;
						const body: IDataObject = {
							name: name.trim(),
							description: description?.trim() ?? '',
							tag_ids: tagIdsStr?.trim()
								? tagIdsStr.split(',').map((id) => id.trim()).filter(Boolean)
								: [],
							chunker_type: chunkerType?.trim() || 'recursive',
							chunk_size: chunkSize,
							chunk_overlap: chunkOverlap,
							embedding_model: embeddingModel?.trim() || 'text-embedding-3-small',
							coalesce_neighbors: coalesceNeighbors,
							reconcile_enabled: reconcileEnabled,
						};
						if (reconcileEnabled && reconcileIntervalSeconds != null && reconcileIntervalSeconds >= 60) {
							body.reconcile_interval_seconds = reconcileIntervalSeconds;
						}
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/knowledge-bases`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'update': {
						const kbId = this.getNodeParameter('kbId', itemIndex) as string;
						const name = this.getNodeParameter('name', itemIndex) as string;
						const description = this.getNodeParameter('description', itemIndex, '') as string;
						const tagIdsStr = this.getNodeParameter('tagIds', itemIndex, '') as string;
						const coalesceNeighbors = this.getNodeParameter('coalesceNeighbors', itemIndex, 0) as number;
						const reconcileEnabled = this.getNodeParameter('reconcileEnabled', itemIndex, false) as boolean;
						const reconcileIntervalSeconds = this.getNodeParameter(
							'reconcileIntervalSeconds',
							itemIndex,
							undefined,
						) as number | undefined;
						const body: IDataObject = {
							name: name.trim(),
							description: description?.trim() ?? '',
							tag_ids: tagIdsStr?.trim()
								? tagIdsStr.split(',').map((id) => id.trim()).filter(Boolean)
								: [],
							coalesce_neighbors: coalesceNeighbors,
							reconcile_enabled: reconcileEnabled,
						};
						if (reconcileEnabled && reconcileIntervalSeconds != null && reconcileIntervalSeconds >= 60) {
							body.reconcile_interval_seconds = reconcileIntervalSeconds;
						}
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'delete': {
						const kbId = this.getNodeParameter('kbId', itemIndex) as string;
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterOrgApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/knowledge-bases/${kbId}`,
							json: true,
						});
						response = { success: true, kbId };
						break;
					}

					default:
						if (operation === '__CUSTOM_API_CALL__') {
							throw new NodeOperationError(
								this.getNode(),
								'For custom API calls, use the HTTP Request node and choose "DocRouter Organization API" under Authentication → Predefined Credential Type. This node only supports List, Get, Create, Update, Delete, List Documents, List Chunks, Search, Chat, Reconcile, and Reconcile All.',
							);
						}
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				pushOne(response, itemIndex);
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

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterSchema implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter Schema',
		name: 'docRouterSchema',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage schemas (structured output definitions) in DocRouter.ai',
		defaults: {
			name: 'DocRouter Schema',
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
						description: 'List schemas in the organization',
						action: 'List schemas',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a schema by revision ID',
						action: 'Get a schema',
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a schema',
						action: 'Create a schema',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a schema',
						action: 'Update a schema',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a schema',
						action: 'Delete a schema',
					},
					{
						name: 'Validate',
						value: 'validate',
						description: 'Validate data against a schema revision',
						action: 'Validate against schema',
					},
					{
						name: 'List Versions',
						value: 'listVersions',
						description: 'List all versions of a schema',
						action: 'List schema versions',
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
				displayOptions: { show: { operation: ['list'] } },
				description: 'Maximum number of schemas to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['list'] } },
				description: 'Number of schemas to skip (pagination)',
			},
			{
				displayName: 'Name Search',
				name: 'nameSearch',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['list'] } },
				description: 'Search term for schema names',
			},
			// ===== Get: schema revision ID =====
			{
				displayName: 'Schema Revision ID',
				name: 'schemaRevid',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['get', 'validate'] } },
				description: 'The schema revision ID',
			},
			// ===== Update / Delete / List Versions: schema ID =====
			{
				displayName: 'Schema ID',
				name: 'schemaId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['update', 'delete', 'listVersions'] } },
				description: 'The schema ID (stable id, not revision)',
			},
			// ===== Create / Update: schema config =====
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description: 'Schema name',
			},
			{
				displayName: 'JSON Schema',
				name: 'jsonSchema',
				type: 'json',
				default: '{}',
				required: true,
				displayOptions: { show: { operation: ['create', 'update'] } },
				description:
					'JSON schema definition (OpenAI structured outputs format: type, json_schema.name, json_schema.schema, strict)',
			},
			// ===== Validate: data to validate =====
			{
				displayName: 'Data to Validate',
				name: 'validateData',
				type: 'json',
				default: '{}',
				required: true,
				displayOptions: { show: { operation: ['validate'] } },
				description: 'JSON object to validate against the schema revision',
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
						url: `/v0/orgs/${organizationId}/schemas`,
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

		if (operation === 'listVersions') {
			try {
				const schemaId = this.getNodeParameter('schemaId', 0) as string;
				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'docRouterOrgApi',
					{
						method: 'GET',
						baseURL: baseUrl,
						url: `/v0/orgs/${organizationId}/schemas/${schemaId}/versions`,
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

		if (operation === 'validate') {
			try {
				const schemaRevid = this.getNodeParameter('schemaRevid', 0) as string;
				const validateDataParam = this.getNodeParameter('validateData', 0) as string | IDataObject;
				const validateData =
					typeof validateDataParam === 'string'
						? (JSON.parse(validateDataParam || '{}') as IDataObject)
						: (validateDataParam as IDataObject);

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'docRouterOrgApi',
					{
						method: 'POST',
						baseURL: baseUrl,
						url: `/v0/orgs/${organizationId}/schemas/${schemaRevid}/validate`,
						body: validateData,
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
						const schemaRevid = this.getNodeParameter('schemaRevid', itemIndex) as string;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'GET',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/schemas/${schemaRevid}`,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'create': {
						const name = this.getNodeParameter('name', itemIndex) as string;
						const jsonSchemaParam = this.getNodeParameter('jsonSchema', itemIndex) as
							| string
							| IDataObject;
						const jsonSchema =
							typeof jsonSchemaParam === 'string'
								? (JSON.parse(jsonSchemaParam || '{}') as IDataObject)
								: (jsonSchemaParam as IDataObject);

						const body: IDataObject = {
							name: name.trim(),
							json_schema: jsonSchema,
						};

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/schemas`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'update': {
						const schemaId = this.getNodeParameter('schemaId', itemIndex) as string;
						const name = this.getNodeParameter('name', itemIndex) as string;
						const jsonSchemaParam = this.getNodeParameter('jsonSchema', itemIndex) as
							| string
							| IDataObject;
						const jsonSchema =
							typeof jsonSchemaParam === 'string'
								? (JSON.parse(jsonSchemaParam || '{}') as IDataObject)
								: (jsonSchemaParam as IDataObject);

						const body: IDataObject = {
							name: name.trim(),
							json_schema: jsonSchema,
						};

						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterOrgApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/orgs/${organizationId}/schemas/${schemaId}`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}

					case 'delete': {
						const schemaId = this.getNodeParameter('schemaId', itemIndex) as string;
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterOrgApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/orgs/${organizationId}/schemas/${schemaId}`,
							json: true,
						});
						response = { success: true, schemaId };
						break;
					}

					default:
						if (operation === '__CUSTOM_API_CALL__') {
							throw new NodeOperationError(
								this.getNode(),
								'For custom API calls, use the HTTP Request node and choose "DocRouter Organization API" under Authentication → Predefined Credential Type. This node only supports List, Get, Create, Update, Delete, Validate, and List Versions.',
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

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class DocRouterAccount implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DocRouter',
		name: 'docRouterAccount',
		icon: { light: 'file:../../icons/docrouter.svg', dark: 'file:../../icons/docrouter.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Manage account users and organizations in DocRouter.ai',
		defaults: {
			name: 'DocRouter Account',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'docRouterAccountApi',
				required: true,
			},
		],
		properties: [
			// eslint-disable-next-line -- Users and Organizations kept as flat operations (10 ops); resource grouping would split Users vs Orgs
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				/* eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items -- Users first, then Organizations; List/Get before Create/Update/Delete */
				options: [
					{ name: 'List Users', value: 'listUsers', action: 'List users' },
					{ name: 'Get User', value: 'getUser', description: 'Get a user by ID', action: 'Get user' },
					{ name: 'Create User', value: 'createUser', description: 'Create a user', action: 'Create user' },
					{ name: 'Update User', value: 'updateUser', description: 'Update a user', action: 'Update user' },
					{ name: 'Delete User', value: 'deleteUser', description: 'Delete a user', action: 'Delete user' },
					{ name: 'List Organizations', value: 'listOrganizations', action: 'List organizations' },
					{ name: 'Get Organization', value: 'getOrganization', description: 'Get an organization by ID', action: 'Get organization' },
					{ name: 'Create Organization', value: 'createOrganization', description: 'Create an organization', action: 'Create organization' },
					{ name: 'Update Organization', value: 'updateOrganization', description: 'Update an organization', action: 'Update organization' },
					{ name: 'Delete Organization', value: 'deleteOrganization', description: 'Delete an organization', action: 'Delete organization' },
				],
				default: 'listUsers',
			},
			// ===== Users List =====
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { min: 1, max: 100 },
				default: 50,
				displayOptions: { show: { operation: ['listUsers'] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'Skip',
				name: 'skip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['listUsers'] } },
				description: 'Number to skip (pagination)',
			},
			{
				displayName: 'Organization ID',
				name: 'organizationIdFilter',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['listUsers'] } },
				description: 'Filter users by organization ID',
			},
			{
				displayName: 'Search Name',
				name: 'searchName',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['listUsers'] } },
				description: 'Case-insensitive search in name or email',
			},
			// ===== Get User / Update User / Delete User =====
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getUser', 'updateUser', 'deleteUser'] } },
			},
			// ===== Create User =====
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createUser'] } },
				description: 'User email',
				placeholder: 'name@email.com',
			},
			{
				displayName: 'Name',
				name: 'userName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createUser'] } },
				description: 'User display name',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createUser'] } },
				description: 'User password',
			},
			// ===== Update User =====
			{
				displayName: 'Name',
				name: 'userNameUpdate',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['updateUser'] } },
				description: 'User display name',
			},
			{
				displayName: 'Password',
				name: 'passwordUpdate',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { operation: ['updateUser'] } },
				description: 'New password (leave empty to keep current)',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'options',
				options: [
					{ name: 'User', value: 'user' },
					{ name: 'Admin', value: 'admin' },
				],
				default: 'user',
				displayOptions: { show: { operation: ['updateUser'] } },
				description: 'User role (admin only)',
			},
			{
				displayName: 'Email Verified',
				name: 'emailVerified',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['updateUser'] } },
				description: 'Whether the user email is verified',
			},
			{
				displayName: 'Has Seen Tour',
				name: 'hasSeenTour',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['updateUser'] } },
				description: 'Whether the user has seen the tour',
			},
			// ===== Organizations List =====
			{
				displayName: 'Limit',
				name: 'orgLimit',
				type: 'number',
				typeOptions: { min: 1, max: 100 },
				default: 10,
				displayOptions: { show: { operation: ['listOrganizations'] } },
				description: 'Maximum number of organizations to return',
			},
			{
				displayName: 'Skip',
				name: 'orgSkip',
				type: 'number',
				typeOptions: { min: 0 },
				default: 0,
				displayOptions: { show: { operation: ['listOrganizations'] } },
				description: 'Number to skip (pagination)',
			},
			{
				displayName: 'User ID',
				name: 'orgUserId',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['listOrganizations'] } },
				description: 'Filter organizations by user ID',
			},
			{
				displayName: 'Name Search',
				name: 'nameSearch',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['listOrganizations'] } },
				description: 'Case-insensitive search on organization name',
			},
			{
				displayName: 'Member Search',
				name: 'memberSearch',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['listOrganizations'] } },
				description: 'Case-insensitive search on member name or email',
			},
			// ===== Get Organization / Update Organization / Delete Organization =====
			{
				displayName: 'Organization ID',
				name: 'organizationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getOrganization', 'updateOrganization', 'deleteOrganization'] } },
			},
			// ===== Create Organization =====
			{
				displayName: 'Name',
				name: 'orgName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['createOrganization'] } },
				description: 'Organization name',
			},
			{
				displayName: 'Type',
				name: 'orgType',
				type: 'options',
				options: [
					{ name: 'Individual', value: 'individual' },
					{ name: 'Team', value: 'team' },
					{ name: 'Enterprise', value: 'enterprise' },
				],
				default: 'individual',
				displayOptions: { show: { operation: ['createOrganization'] } },
				description: 'Organization type',
			},
			// ===== Update Organization =====
			{
				displayName: 'Name',
				name: 'orgNameUpdate',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['updateOrganization'] } },
				description: 'Organization name',
			},
			{
				displayName: 'Type',
				name: 'orgTypeUpdate',
				type: 'options',
				options: [
					{ name: 'Individual', value: 'individual' },
					{ name: 'Team', value: 'team' },
					{ name: 'Enterprise', value: 'enterprise' },
				],
				default: 'individual',
				displayOptions: { show: { operation: ['updateOrganization'] } },
				description: 'Organization type',
			},
			{
				displayName: 'Members',
				name: 'members',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['updateOrganization'] } },
				description: 'JSON array of members, e.g. [{"user_id":"...","role":"admin"},{"user_id":"...","role":"user"}]. Must include at least one admin.',
				placeholder: '[{"user_id":"...","role":"admin"}]',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('docRouterAccountApi');
		const baseUrl =
			(credentials?.baseUrl as string)?.trim() || 'https://app.docrouter.ai/fastapi';

		const runOnce = ['listUsers', 'listOrganizations', 'getUser', 'getOrganization'].includes(operation);

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

		if (runOnce) {
			try {
				let response: IDataObject;
				if (operation === 'listUsers') {
					const limit = this.getNodeParameter('limit', 0, 10) as number;
					const skip = this.getNodeParameter('skip', 0, 0) as number;
					const organizationIdFilter = this.getNodeParameter('organizationIdFilter', 0, '') as string;
					const searchName = this.getNodeParameter('searchName', 0, '') as string;
					const qs: IDataObject = { limit, skip };
					if (organizationIdFilter?.trim()) qs.organization_id = organizationIdFilter.trim();
					if (searchName?.trim()) qs.search_name = searchName.trim();
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterAccountApi',
						{ method: 'GET', baseURL: baseUrl, url: '/v0/account/users', qs, json: true },
					)) as IDataObject;
				} else if (operation === 'getUser') {
					const userId = this.getNodeParameter('userId', 0) as string;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterAccountApi',
						{ method: 'GET', baseURL: baseUrl, url: '/v0/account/users', qs: { user_id: userId.trim() }, json: true },
					)) as IDataObject;
				} else if (operation === 'listOrganizations') {
					const limit = this.getNodeParameter('orgLimit', 0, 10) as number;
					const skip = this.getNodeParameter('orgSkip', 0, 0) as number;
					const userId = this.getNodeParameter('orgUserId', 0, '') as string;
					const nameSearch = this.getNodeParameter('nameSearch', 0, '') as string;
					const memberSearch = this.getNodeParameter('memberSearch', 0, '') as string;
					const qs: IDataObject = { limit, skip };
					if (userId?.trim()) qs.user_id = userId.trim();
					if (nameSearch?.trim()) qs.name_search = nameSearch.trim();
					if (memberSearch?.trim()) qs.member_search = memberSearch.trim();
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterAccountApi',
						{ method: 'GET', baseURL: baseUrl, url: '/v0/account/organizations', qs, json: true },
					)) as IDataObject;
				} else {
					// getOrganization
					const organizationId = this.getNodeParameter('organizationId', 0) as string;
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'docRouterAccountApi',
						{ method: 'GET', baseURL: baseUrl, url: '/v0/account/organizations', qs: { organization_id: organizationId.trim() }, json: true },
					)) as IDataObject;
				}
				returnData.push({ json: (response ?? {}) as IDataObject, pairedItem: { item: 0 } });
			} catch (error) {
				handleError(error, 0);
			}
			return [returnData];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				let response: IDataObject;
				switch (operation) {
					case 'createUser': {
						const email = this.getNodeParameter('email', i) as string;
						const userName = this.getNodeParameter('userName', i) as string;
						const password = this.getNodeParameter('password', i) as string;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterAccountApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: '/v0/account/users',
								body: { email: email.trim(), name: userName.trim(), password },
								json: true,
							},
						)) as IDataObject;
						break;
					}
					case 'updateUser': {
						const userId = this.getNodeParameter('userId', i) as string;
						const body: IDataObject = {};
						const userNameUpdate = this.getNodeParameter('userNameUpdate', i, '') as string;
						const passwordUpdate = this.getNodeParameter('passwordUpdate', i, '') as string;
						const role = this.getNodeParameter('role', i, '') as string;
						const nodeParams = this.getNode().parameters as IDataObject;
						if (userNameUpdate !== undefined && userNameUpdate !== '') body.name = userNameUpdate.trim();
						if (passwordUpdate !== undefined && passwordUpdate !== '') body.password = passwordUpdate;
						if ('role' in nodeParams && nodeParams.role != null) body.role = role || nodeParams.role;
						if ('emailVerified' in nodeParams && nodeParams.emailVerified != null) body.email_verified = nodeParams.emailVerified;
						if ('hasSeenTour' in nodeParams && nodeParams.hasSeenTour != null) body.has_seen_tour = nodeParams.hasSeenTour;
						if (Object.keys(body).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Provide at least one field to update (name, password, role, email verified, or has seen tour).',
							);
						}
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterAccountApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/account/users/${userId.trim()}`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}
					case 'deleteUser': {
						const userId = this.getNodeParameter('userId', i) as string;
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterAccountApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/account/users/${userId.trim()}`,
							json: true,
						});
						response = { success: true, user_id: userId.trim() };
						break;
					}
					case 'createOrganization': {
						const orgName = this.getNodeParameter('orgName', i) as string;
						const orgType = this.getNodeParameter('orgType', i, 'individual') as string;
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterAccountApi',
							{
								method: 'POST',
								baseURL: baseUrl,
								url: '/v0/account/organizations',
								body: { name: orgName.trim(), type: orgType || 'individual' },
								json: true,
							},
						)) as IDataObject;
						break;
					}
					case 'updateOrganization': {
						const organizationId = this.getNodeParameter('organizationId', i) as string;
						const body: IDataObject = {};
						const orgNameUpdate = this.getNodeParameter('orgNameUpdate', i, '') as string;
						const orgTypeUpdate = this.getNodeParameter('orgTypeUpdate', i, '') as string;
						const membersParam = this.getNodeParameter('members', i, '') as string;
						const nodeParams = this.getNode().parameters as IDataObject;
						if (orgNameUpdate !== undefined && orgNameUpdate !== '') body.name = orgNameUpdate.trim();
						if ('orgTypeUpdate' in nodeParams && nodeParams.orgTypeUpdate != null) body.type = orgTypeUpdate || nodeParams.orgTypeUpdate;
						if (membersParam && typeof membersParam === 'string' && membersParam.trim()) {
							try {
								body.members = JSON.parse(membersParam.trim()) as IDataObject[];
							} catch {
								throw new NodeOperationError(this.getNode(), 'Members must be a valid JSON array');
							}
						}
						response = (await this.helpers.httpRequestWithAuthentication.call(
							this,
							'docRouterAccountApi',
							{
								method: 'PUT',
								baseURL: baseUrl,
								url: `/v0/account/organizations/${organizationId.trim()}`,
								body,
								json: true,
							},
						)) as IDataObject;
						break;
					}
					case 'deleteOrganization': {
						const organizationId = this.getNodeParameter('organizationId', i) as string;
						await this.helpers.httpRequestWithAuthentication.call(this, 'docRouterAccountApi', {
							method: 'DELETE',
							baseURL: baseUrl,
							url: `/v0/account/organizations/${organizationId.trim()}`,
							json: true,
						});
						response = { success: true, organization_id: organizationId.trim() };
						break;
					}
					default:
						if (operation === '__CUSTOM_API_CALL__') {
							throw new NodeOperationError(
								this.getNode(),
								'For custom API calls, use the HTTP Request node with DocRouter Account API credentials. This node only supports account users and organizations operations.',
							);
						}
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}
				returnData.push({ json: response ?? {}, pairedItem: { item: i } });
			} catch (error) {
				handleError(error, i);
			}
		}
		return [returnData];
	}
}

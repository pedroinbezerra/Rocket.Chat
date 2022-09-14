import { escapeRegExp } from '@rocket.chat/string-helpers';
import type {
	IBanner,
	ILivechatAgent,
	ILivechatBusinessHour,
	ILivechatDepartment,
	IRole,
	IRoom,
	IUser,
	RocketChatRecordDeleted,
} from '@rocket.chat/core-typings';
import type { Collection, FindCursor, Db, Filter, FindOptions, UpdateResult, UpdateFilter, WithId, Document } from 'mongodb';
import type { PaginatedRequest } from '@rocket.chat/rest-typings';
import { ILivechatAgentStatus, UserStatus } from '@rocket.chat/core-typings';
import { FindPaginated, IUsersModel } from '@rocket.chat/model-typings';

import { BaseRaw } from './BaseRaw';

const inDevelopment = process.env.NODE_ENV === 'development';

export class UsersRaw extends BaseRaw<IUser> implements IUsersModel {
	constructor(db: Db, trash?: Collection<RocketChatRecordDeleted<IUser>>) {
		super(db, 'users', trash, {
			collectionNameResolver(name) {
				return name;
			},
		});

		// FIXME
		// @ts-ignore
		this.defaultFields = {
			__rooms: 0,
		};
	}

	/**
	 * @param {string} uid
	 * @param {IRole['_id'][]} roleIds list of role ids
	 */
	async addRolesByUserId(uid: IUser['_id'], roleIds: IRole['_id'][]): Promise<UpdateResult> {
		// FIXME change all occurences of non-arrays
		if (!Array.isArray(roleIds)) {
			roleIds = [roleIds];
			if (inDevelopment) {
				console.warn('[WARN] Users.addRolesByUserId: roles should be an array');
			}
		}

		const query: Filter<IUser> = {
			_id: uid,
		};

		const update: UpdateFilter<IUser> = {
			$addToSet: {
				roles: { $each: roleIds },
			},
		};
		return this.updateOne(query, update);
	}

	/**
	 * @param {IRole['_id'][]} roleIds list of role ids
	 * @param {null} _scope the value for the role scope (room id) - not used in the users collection
	 * @param {any} options
	 */
	findUsersInRoles(roleIds: IRole['_id'][] | IRole['_id'], _scope: null, options: FindOptions<IUser>): FindCursor<IUser> {
		// FIXME
		if (!Array.isArray(roleIds)) {
			roleIds = [roleIds];
			if (inDevelopment) {
				console.warn(`[WARN] Users.findUsersInRoles: roles should be an array`);
			}
		}

		const query: Filter<IUser> = {
			roles: { $in: roleIds },
		};

		return this.find(query, options);
	}

	findPaginatedUsersInRoles(roleIds: IRole['_id'][], options: FindOptions<IUser>): FindPaginated<FindCursor<WithId<IUser>>> {
		// FIXME
		if (!Array.isArray(roleIds)) {
			roleIds = [roleIds];
			if (inDevelopment) {
				console.warn(`[WARN] Users.findPaginatedUsersInRoles: roles should be an array`);
			}
		}

		const query = {
			roles: { $in: roleIds },
		};

		return this.findPaginated(query, options);
	}

	findOneByUsername(username: IUser['username'], options: FindOptions<IUser>): Promise<IUser | null> {
		const query: Filter<IUser> = { username };
		return this.findOne(query, options);
	}

	findOneAgentById(_id: ILivechatAgent['_id'], options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null> {
		const query: Filter<ILivechatAgent> = {
			_id,
			roles: 'livechat-agent',
		};

		return this.findOne(query as any, options) as Promise<ILivechatAgent | null>;
	}

	/**
	 * @param {IRole['_id'][] | IRole['_id']} roleIds the list of role ids
	 * @param {any} query
	 * @param {any} options
	 */
	findUsersInRolesWithQuery(roleIds: IRole['_id'][] | IRole['_id'], query: Filter<IUser>, options: FindOptions<IUser>): FindCursor<IUser> {
		// FIXME
		roleIds = Array.isArray(roleIds) ? roleIds : [roleIds];

		Object.assign(query, { roles: { $in: roleIds } });

		return this.find(query, options);
	}

	/**
	 * @param {IRole['_id'][] | IRole['_id']} roles the list of role ids
	 * @param {any} query
	 * @param {any} options
	 */
	findPaginatedUsersInRolesWithQuery(
		roles: IRole['_id'][],
		query: Filter<IUser>,
		options: FindOptions<IUser>,
	): FindPaginated<FindCursor<WithId<IUser>>> {
		// FIXME
		// @ts-ignore
		roles = [].concat(roles);

		Object.assign(query, { roles: { $in: roles } });

		return this.findPaginated(query, options);
	}

	findOneByUsernameAndRoomIgnoringCase(
		username: IUser['username'] | RegExp,
		rid: IRoom['_id'],
		options: FindOptions<IUser>,
	): Promise<IUser | null> {
		if (typeof username === 'string') {
			username = new RegExp(`^${escapeRegExp(username)}$`, 'i');
		}

		const query: Filter<IUser> = {
			__rooms: rid,
			username,
		};

		return this.findOne(query, options);
	}

	findOneByIdAndLoginHashedToken(_id: IUser['_id'], token: string, options: FindOptions<IUser>): Promise<IUser | null> {
		const query: Filter<IUser> = {
			_id,
			'services.resume.loginTokens.hashedToken': token,
		};

		return this.findOne(query, options);
	}

	findByActiveUsersExcept(
		searchTerm: string,
		exceptions: IUser['username'][] | IUser['username'] = [],
		options: FindOptions<IUser> = {},
		// FIXME
		searchFields: any,
		extraQuery: any[] = [],
		{ startsWith = false, endsWith = false } = {},
	): FindCursor<IUser> {
		if (exceptions === null) {
			exceptions = [];
		}

		if (options === null) {
			options = {};
		}

		if (!Array.isArray(exceptions)) {
			exceptions = [exceptions];
		}

		const termRegex = new RegExp((startsWith ? '^' : '') + escapeRegExp(searchTerm) + (endsWith ? '$' : ''), 'i');

		const orStmt = (searchFields || []).reduce(function (acc: any, el: any) {
			acc.push({ [el.trim()]: termRegex });
			return acc;
		}, []);

		const query = {
			$and: [
				{
					active: true,
					username: {
						$exists: true,
						...(exceptions.length > 0 && { $nin: exceptions }),
					},
					// if the search term is empty, don't need to have the $or statement (because it would be an empty regex)
					...(searchTerm && orStmt.length > 0 && { $or: orStmt }),
				},
				...extraQuery,
			],
		};

		return this.find(query, options);
	}

	findPaginatedByActiveUsersExcept(
		searchTerm: string,
		exceptions: IUser['username'][] | IUser['username'] = [],
		options: FindOptions<IUser> = {},
		// FIXME: v
		searchFields: any,
		extraQuery: any[] = [],
		{ startsWith = false, endsWith = false } = {},
	): FindPaginated<FindCursor<WithId<IUser>>> {
		if (exceptions == null) {
			exceptions = [];
		}
		if (options == null) {
			options = {};
		}
		if (!Array.isArray(exceptions)) {
			exceptions = [exceptions];
		}

		const termRegex = new RegExp((startsWith ? '^' : '') + escapeRegExp(searchTerm) + (endsWith ? '$' : ''), 'i');

		const orStmt = (searchFields || []).reduce(function (acc: any, el: any) {
			acc.push({ [el.trim()]: termRegex });
			return acc;
		}, []);

		const query = {
			$and: [
				{
					active: true,
					username: {
						$exists: true,
						...(exceptions.length > 0 && { $nin: exceptions }),
					},
					// if the search term is empty, don't need to have the $or statement (because it would be an empty regex)
					...(searchTerm && orStmt.length > 0 && { $or: orStmt }),
				},
				...extraQuery,
			],
		};

		return this.findPaginated(query, options);
	}

	findPaginatedByActiveLocalUsersExcept(
		searchTerm: string,
		exceptions: IUser['username'][],
		options: FindOptions<IUser>,
		forcedSearchFields: any,
		localDomain: string,
	): FindPaginated<FindCursor<WithId<IUser>>> {
		const extraQuery = [
			{
				$or: [{ federation: { $exists: false } }, { 'federation.origin': localDomain }],
			},
		];
		return this.findPaginatedByActiveUsersExcept(searchTerm, exceptions, options, forcedSearchFields, extraQuery);
	}

	findPaginatedByActiveExternalUsersExcept(
		searchTerm: string,
		exceptions: IUser['username'][],
		options: FindOptions<IUser>,
		forcedSearchFields: any,
		localDomain: string,
	): FindPaginated<FindCursor<WithId<IUser>>> {
		const extraQuery = [{ federation: { $exists: true } }, { 'federation.origin': { $ne: localDomain } }];
		return this.findPaginatedByActiveUsersExcept(searchTerm, exceptions, options, forcedSearchFields, extraQuery);
	}

	findActive(query: Filter<IUser>, options: FindOptions<IUser> = {}): FindCursor<IUser> {
		Object.assign(query, { active: true });

		return this.find(query, options);
	}

	findActiveByIds(userIds: IUser['_id'][], options: FindOptions<IUser> = {}): FindCursor<IUser> {
		const query = {
			_id: { $in: userIds },
			active: true,
		};

		return this.find(query, options);
	}

	findActiveByIdsOrUsernames(userIds: IUser['_id'][], options: FindOptions<IUser> = {}): FindCursor<IUser> {
		const query = {
			$or: [{ _id: { $in: userIds } }, { username: { $in: userIds } }],
			active: true,
		};

		return this.find(query, options);
	}

	findByIds(userIds: IUser['_id'][], options: FindOptions<IUser> = {}): FindCursor<IUser> {
		const query = {
			_id: { $in: userIds },
		};

		return this.find(query, options);
	}

	findOneByUsernameIgnoringCase(username: IUser['username'] | RegExp, options: FindOptions<IUser> = {}): Promise<IUser | null> {
		if (typeof username === 'string') {
			username = new RegExp(`^${escapeRegExp(username)}$`, 'i');
		}

		const query = { username };

		return this.findOne(query, options);
	}

	async findOneByLDAPId(id: string, attribute: any = undefined): Promise<IUser | null> {
		const query: Filter<IUser> = {
			'services.ldap.id': id,
		};

		if (attribute) {
			query['services.ldap.idAttribute'] = attribute;
		}

		return this.findOne(query);
	}

<<<<<<< HEAD:apps/meteor/server/models/raw/Users.ts
	findLDAPUsers(options: FindOptions<IUser> = {}): FindCursor<IUser> {
=======
	async findOneByAppId(appId, options) {
		const query = { appId };

		return this.findOne(query, options);
	}

	findLDAPUsers(options) {
>>>>>>> develop:apps/meteor/server/models/raw/Users.js
		const query = { ldap: true };

		return this.find(query, options);
	}

	findConnectedLDAPUsers(options: FindOptions<IUser> = {}): FindCursor<IUser> {
		const query = {
			'ldap': true,
			'services.resume.loginTokens': {
				$exists: true,
				$ne: [],
			},
		};

		return this.find(query, options);
	}

	async isUserInRole(userId: IUser['_id'], roleId: IRole['_id']): Promise<boolean> {
		const query = {
			_id: userId,
			roles: roleId,
		};

		return Boolean(this.findOne<Pick<IUser, '_id'>>(query, { projection: { _id: 1 } }));
	}

	getDistinctFederationDomains(): Promise<any> {
		return this.col.distinct('federation.origin', { federation: { $exists: true } });
	}

	async getNextLeastBusyAgent(
		department: ILivechatDepartment['_id'],
		ignoreAgentId: ILivechatAgent['_id'],
	): Promise<{
		agentId: ILivechatAgent['_id'];
		username: ILivechatAgent['username'];
		lastRoutingTime: ILivechatAgent['lastRoutingTime'];
		departments: ILivechatDepartment['_id'][];
		count: number;
	} | null> {
		const aggregate: any = [
			{
				$match: {
					status: { $exists: true, $ne: 'offline' },
					statusLivechat: 'available',
					roles: 'livechat-agent',
					...(ignoreAgentId && { _id: { $ne: ignoreAgentId } }),
				},
			},
			{
				$lookup: {
					from: 'rocketchat_subscription',
					let: { id: '$_id' },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ['$u._id', '$$id'] },
										{ $eq: ['$open', true] },
										{ $ne: ['$onHold', true] },
										{ ...(department && { $eq: ['$department', department] }) },
									],
								},
							},
						},
					],
					as: 'subs',
				},
			},
			{
				$lookup: {
					from: 'rocketchat_livechat_department_agents',
					localField: '_id',
					foreignField: 'agentId',
					as: 'departments',
				},
			},
			{
				$project: {
					agentId: '$_id',
					username: 1,
					lastRoutingTime: 1,
					departments: 1,
					count: { $size: '$subs' },
				},
			},
			{ $sort: { count: 1, lastRoutingTime: 1, username: 1 } },
		];

		if (department) {
			aggregate.push({ $unwind: '$departments' });
			aggregate.push({ $match: { 'departments.departmentId': department } });
		}

		aggregate.push({ $limit: 1 });

		const agent = await this.col
			.aggregate<{
				agentId: ILivechatAgent['_id'];
				username: ILivechatAgent['username'];
				lastRoutingTime: ILivechatAgent['lastRoutingTime'];
				departments: ILivechatDepartment['_id'][];
				count: number;
			}>(aggregate)
			.next();
		if (agent) {
			await this.setLastRoutingTime(agent.agentId);
		}

		return agent;
	}

	async getLastAvailableAgentRouted(
		department: ILivechatDepartment['_id'],
		ignoreAgentId: ILivechatAgent['_id'],
	): Promise<{
		agentId: ILivechatAgent['_id'];
		username: ILivechatAgent['username'];
		lastRoutingTime: ILivechatAgent['lastRoutingTime'];
		departments: ILivechatDepartment['_id'][];
	} | null> {
		const aggregate: any = [
			{
				$match: {
					status: { $exists: true, $ne: 'offline' },
					statusLivechat: 'available',
					roles: 'livechat-agent',
					...(ignoreAgentId && { _id: { $ne: ignoreAgentId } }),
				},
			},
			{
				$lookup: {
					from: 'rocketchat_livechat_department_agents',
					localField: '_id',
					foreignField: 'agentId',
					as: 'departments',
				},
			},
			{ $project: { agentId: '$_id', username: 1, lastRoutingTime: 1, departments: 1 } },
			{ $sort: { lastRoutingTime: 1, username: 1 } },
		];

		if (department) {
			aggregate.push({ $unwind: '$departments' });
			aggregate.push({ $match: { 'departments.departmentId': department } });
		}

		aggregate.push({ $limit: 1 });

		const agent = await this.col
			.aggregate<{
				agentId: ILivechatAgent['_id'];
				username: ILivechatAgent['username'];
				lastRoutingTime: ILivechatAgent['lastRoutingTime'];
				departments: ILivechatDepartment['_id'][];
			}>(aggregate)
			.next();
		if (agent) {
			await this.setLastRoutingTime(agent.agentId);
		}

		return agent;
	}

<<<<<<< HEAD:apps/meteor/server/models/raw/Users.ts
	async setLastRoutingTime(agentId: ILivechatAgent['_id']): Promise<WithId<IUser> | null> {
		// FIXME
		const result = await this.col.findOneAndUpdate(
			{ _id: agentId },
=======
	async setLastRoutingTime(userId) {
		const result = await this.findOneAndUpdate(
			{ _id: userId },
>>>>>>> develop:apps/meteor/server/models/raw/Users.js
			{
				$set: {
					lastRoutingTime: new Date(),
				},
			},
			{ returnDocument: 'after' },
		);
		return result.value;
	}

	setLivechatStatusIf(
		agentId: ILivechatAgent['_id'],
		status: ILivechatAgentStatus,
		conditions: any = {},
		extraFields: any = {},
	): Promise<UpdateResult> {
		// TODO: Create class Agent
		const query = {
			_id: agentId,
			...conditions,
		};

		const update = {
			$set: {
				statusLivechat: status,
				...extraFields,
			},
		};

		return this.updateOne(query, update);
	}

	async getAgentAndAmountOngoingChats(agentId: ILivechatAgent['_id']): Promise<{
		'agentId': ILivechatAgent['_id'];
		'username': ILivechatAgent['username'];
		'lastAssignTime': ILivechatAgent['lastAssignTime'];
		'lastRoutingTime': ILivechatAgent['lastRoutingTime'];
		'queueInfo.chats': number;
	} | null> {
		const aggregate: Exclude<Parameters<Collection<ILivechatAgent>['aggregate']>[0], undefined> = [
			{
				$match: {
<<<<<<< HEAD:apps/meteor/server/models/raw/Users.ts
					_id: agentId,
					status: { $exists: true, $ne: 'offline' },
=======
					_id: userId,
>>>>>>> develop:apps/meteor/server/models/raw/Users.js
					statusLivechat: 'available',
					roles: 'livechat-agent',
				},
			},
			{
				$lookup: {
					from: 'rocketchat_subscription',
					localField: '_id',
					foreignField: 'u._id',
					as: 'subs',
				},
			},
			{
				$project: {
					'agentId': '$_id',
					'username': 1,
					'lastAssignTime': 1,
					'lastRoutingTime': 1,
					'queueInfo.chats': {
						$size: {
							$filter: {
								input: '$subs',
								as: 'sub',
								cond: {
									$and: [{ $eq: ['$$sub.t', 'l'] }, { $eq: ['$$sub.open', true] }, { $ne: ['$$sub.onHold', true] }],
								},
							},
						},
					},
				},
			},
			{ $sort: { 'queueInfo.chats': 1, 'lastAssignTime': 1, 'lastRoutingTime': 1, 'username': 1 } },
		];

		return this.col
			.aggregate<{
				'agentId': ILivechatAgent['_id'];
				'username': ILivechatAgent['username'];
				'lastAssignTime': ILivechatAgent['lastAssignTime'];
				'lastRoutingTime': ILivechatAgent['lastRoutingTime'];
				'queueInfo.chats': number;
			}>(aggregate)
			.next();
	}

	findAllResumeTokensByUserId(userId: IUser['_id']): Promise<{ _id: IUser['_id']; tokens: string[] } | null> {
		return this.col
			.aggregate<{
				_id: IUser['_id'];
				tokens: string[];
			}>([
				{
					$match: {
						_id: userId,
					},
				},
				{
					$project: {
						tokens: {
							$filter: {
								input: '$services.resume.loginTokens',
								as: 'token',
								cond: {
									$ne: ['$$token.type', 'personalAccessToken'],
								},
							},
						},
					},
				},
				{ $unwind: '$tokens' },
				{ $sort: { 'tokens.when': 1 } },
				{ $group: { _id: '$_id', tokens: { $push: '$tokens' } } },
			])
			.next();
	}

	findActiveByUsernameOrNameRegexWithExceptionsAndConditions(
		termRegex: RegExp,
		exceptions: string[] | string = [],
		conditions: string[] = [],
		options: FindOptions<IUser> = {},
	): FindCursor<IUser> {
		if (!Array.isArray(exceptions)) {
			exceptions = [exceptions];
		}

		const query = {
			$or: [
				{
					username: termRegex,
				},
				{
					name: termRegex,
				},
				{
					nickname: termRegex,
				},
			],
			active: true,
			type: {
				$in: ['user', 'bot'],
			},
			$and: [
				{
					username: {
						$exists: true,
					},
				},
				{
					username: {
						$nin: exceptions,
					},
				},
			],
			...conditions,
		};

		return this.find(query, options);
	}

	countAllAgentsStatus({ departmentId = undefined }: { departmentId?: ILivechatDepartment['_id'] }): Promise<{
		_id: null;
		offline: number;
		away: number;
		busy: number;
		available: number;
	} | null> {
		const match = {
			$match: {
				roles: { $in: ['livechat-agent'] },
			},
		};
		const group = {
			$group: {
				_id: null,
				offline: {
					$sum: {
						$cond: [
							{
								$or: [
									{
										$and: [{ $eq: ['$status', 'offline'] }, { $eq: ['$statusLivechat', 'available'] }],
									},
									{ $eq: ['$statusLivechat', 'not-available'] },
								],
							},
							1,
							0,
						],
					},
				},
				away: {
					$sum: {
						$cond: [
							{
								$and: [{ $eq: ['$status', 'away'] }, { $eq: ['$statusLivechat', 'available'] }],
							},
							1,
							0,
						],
					},
				},
				busy: {
					$sum: {
						$cond: [
							{
								$and: [{ $eq: ['$status', 'busy'] }, { $eq: ['$statusLivechat', 'available'] }],
							},
							1,
							0,
						],
					},
				},
				available: {
					$sum: {
						$cond: [
							{
								$and: [{ $eq: ['$status', 'online'] }, { $eq: ['$statusLivechat', 'available'] }],
							},
							1,
							0,
						],
					},
				},
			},
		};
		const lookup = {
			$lookup: {
				from: 'rocketchat_livechat_department_agents',
				localField: '_id',
				foreignField: 'agentId',
				as: 'departments',
			},
		};
		const unwind = {
			$unwind: {
				path: '$departments',
				preserveNullAndEmptyArrays: true,
			},
		};
		const departmentsMatch = {
			$match: {
				'departments.departmentId': departmentId,
			},
		};
		const params: Exclude<Parameters<Collection<ILivechatAgent>['aggregate']>[0], undefined> = [match];
		if (departmentId && departmentId !== 'undefined') {
			params.push(lookup);
			params.push(unwind);
			params.push(departmentsMatch);
		}
		params.push(group);
		return this.col
			.aggregate<{
				_id: null;
				offline: number;
				away: number;
				busy: number;
				available: number;
			}>(params)
			.next();
	}

	getTotalOfRegisteredUsersByDate({
		start,
		end,
		options = {},
	}: {
		start: Date;
		end: Date;
		options: PaginatedRequest;
	}): Promise<{ date: string; users: number; type: 'users' }[]> {
		const params: Exclude<Parameters<Collection<IUser>['aggregate']>[0], undefined> = [
			{
				$match: {
					createdAt: { $gte: start, $lte: end },
					roles: { $ne: 'anonymous' },
				},
			},
			{
				$group: {
					_id: {
						$concat: [{ $substr: ['$createdAt', 0, 4] }, { $substr: ['$createdAt', 5, 2] }, { $substr: ['$createdAt', 8, 2] }],
					},
					users: { $sum: 1 },
				},
			},
			{
				$group: {
					_id: '$_id',
					users: { $sum: '$users' },
				},
			},
			{
				$project: {
					_id: 0,
					date: '$_id',
					users: 1,
					type: 'users',
				},
			},
		];
		if (options.sort) {
			params.push({ $sort: options.sort });
		}
		if (options.count) {
			params.push({ $limit: options.count });
		}
		return this.col
			.aggregate<{
				date: string;
				users: number;
				type: 'users';
			}>(params)
			.toArray();
	}

	getUserLanguages(): Promise<{ _id: string; total: number } | null> {
		const pipeline = [
			{
				$match: {
					language: {
						$exists: true,
						$ne: '',
					},
				},
			},
			{
				$group: {
					_id: '$language',
					total: { $sum: 1 },
				},
			},
		];

		return this.col.aggregate<{ _id: string; total: number }>(pipeline).next();
	}

	updateStatusText(_id: IUser['_id'], statusText: string): Promise<UpdateResult> {
		const update = {
			$set: {
				statusText,
			},
		};

		return this.updateOne({ _id }, update);
	}

	updateStatusByAppId(appId: string, status: UserStatus): Promise<UpdateResult> {
		// FIXME: add IApp to core-typing maybe?
		const query: any = {
			appId,
			status: { $ne: status },
		};

		const update: UpdateFilter<IUser> = {
			$set: {
				status,
			},
		};

		return this.updateOne(query, update);
	}

	openAgentsBusinessHoursByBusinessHourId(businessHourIds: ILivechatBusinessHour['_id'][]): Promise<Document | UpdateResult> {
		const query = {
			roles: 'livechat-agent',
		};

		const update = {
			$set: {
				statusLivechat: 'available',
			},
			$addToSet: {
				openBusinessHours: { $each: businessHourIds },
			},
		};

		return this.updateMany(query, update);
	}

	openAgentBusinessHoursByBusinessHourIdsAndAgentId(
		businessHourIds: ILivechatBusinessHour['_id'][],
		agentId: ILivechatAgent['_id'],
	): Promise<Document | UpdateResult> {
		const query = {
			_id: agentId,
			roles: 'livechat-agent',
		};

		const update = {
			$set: {
				statusLivechat: 'available',
			},
			$addToSet: {
				openBusinessHours: { $each: businessHourIds },
			},
		};

		return this.updateMany(query, update);
	}

	addBusinessHourByAgentIds(
		agentIds: ILivechatAgent['_id'][] = [],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<Document | UpdateResult> {
		const query = {
			_id: { $in: agentIds },
			roles: 'livechat-agent',
		};

		const update = {
			$set: {
				statusLivechat: 'available',
			},
			$addToSet: {
				openBusinessHours: businessHourId,
			},
		};

		return this.updateMany(query, update);
	}

	removeBusinessHourByAgentIds(
		agentIds: ILivechatAgent['_id'][] = [],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<Document | UpdateResult> {
		const query = {
			_id: { $in: agentIds },
			roles: 'livechat-agent',
		};

		const update = {
			$pull: {
				openBusinessHours: businessHourId,
			},
		};

		return this.updateMany(query, update);
	}

	openBusinessHourToAgentsWithoutDepartment(
		agentIdsWithDepartment: ILivechatAgent['_id'][] = [],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<Document | UpdateResult> {
		const query = {
			_id: { $nin: agentIdsWithDepartment },
		};

		const update = {
			$set: {
				statusLivechat: 'available',
			},
			$addToSet: {
				openBusinessHours: businessHourId,
			},
		};

		return this.updateMany(query, update);
	}

	closeBusinessHourToAgentsWithoutDepartment(
		agentIdsWithDepartment: ILivechatAgent['_id'][] = [],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<UpdateResult | Document> {
		const query = {
			_id: { $nin: agentIdsWithDepartment },
		};

		const update = {
			$pull: {
				openBusinessHours: businessHourId,
			},
		};

		// multi: true
		return this.updateMany(query, update);
	}

	closeAgentsBusinessHoursByBusinessHourIds(businessHourIds: ILivechatBusinessHour['_id'][]): Promise<UpdateResult | Document> {
		const query = {
			roles: 'livechat-agent',
		};

		const update = {
			$pull: {
				openBusinessHours: { $in: businessHourIds },
			},
		};

		return this.updateMany(query, update);
	}

	updateLivechatStatusBasedOnBusinessHours(agentIds: ILivechatAgent['_id'][] = []): Promise<UpdateResult | Document> {
		const query = {
			$or: [{ openBusinessHours: { $exists: false } }, { openBusinessHours: { $size: 0 } }],
			roles: 'livechat-agent',
			...(Array.isArray(agentIds) && agentIds.length > 0 && { _id: { $in: agentIds } }),
		};

		const update = {
			$set: {
				statusLivechat: 'not-available',
			},
		};

		return this.updateMany(query, update);
	}

	setLivechatStatusActiveBasedOnBusinessHours(agentId: ILivechatAgent['_id']): Promise<UpdateResult> {
		const query = {
			_id: agentId,
			openBusinessHours: {
				$exists: true,
				$not: { $size: 0 },
			},
		};

		const update = {
			$set: {
				statusLivechat: 'available',
			},
		};

		return this.updateOne(query, update);
	}

	async isAgentWithinBusinessHours(agentId: ILivechatAgent['_id']): Promise<boolean> {
		return (
			(await this.col.countDocuments({
				_id: agentId,
				openBusinessHours: {
					$exists: true,
					$not: { $size: 0 },
				},
			})) > 0
		);
	}

	removeBusinessHoursFromAllUsers(): Promise<UpdateResult | Document> {
		const query = {
			roles: 'livechat-agent',
			openBusinessHours: {
				$exists: true,
			},
		};

		const update: UpdateFilter<ILivechatAgent> = {
			$unset: {
				openBusinessHours: 1,
			},
		};

		return this.updateMany(query, update);
	}

	resetTOTPById(userId: IUser['_id']): Promise<UpdateResult> {
		return this.col.updateOne(
			{
				_id: userId,
			},
			{
				$unset: {
					'services.totp': 1,
				},
			},
		);
	}

	unsetOneLoginToken(_id: IUser['_id'], token: string): Promise<UpdateResult> {
		const update = {
			$pull: {
				'services.resume.loginTokens': { hashedToken: token },
			},
		};

		return this.col.updateOne({ _id }, update);
	}

	unsetLoginTokens(userId: IUser['_id']): Promise<UpdateResult> {
		return this.col.updateOne(
			{
				_id: userId,
			},
			{
				$set: {
					'services.resume.loginTokens': [],
				},
			},
		);
	}

	removeNonPATLoginTokensExcept(userId: IUser['_id'], authToken: string): Promise<UpdateResult> {
		return this.col.updateOne(
			{
				_id: userId,
			},
			{
				$pull: {
					'services.resume.loginTokens': {
						when: { $exists: true },
						hashedToken: { $ne: authToken },
					},
				},
			},
		);
	}

	removeRoomsByRoomIdsAndUserId(rids: IRoom['_id'][], userId: IUser['_id']): Promise<UpdateResult> {
		return this.updateOne(
			{
				_id: userId,
				__rooms: { $in: rids },
			},
			{
				$pullAll: { __rooms: rids },
			},
		);
	}

	/**
	 * @param {string} uid
	 * @param {IRole['_id']} roles the list of role ids to remove
	 */
	removeRolesByUserId(uid: IUser['_id'], roles: IRole['_id'][]): Promise<UpdateResult> {
		const query = {
			_id: uid,
		};

		const update = {
			$pullAll: {
				roles,
			},
		};

		return this.updateOne(query, update);
	}

	async isUserInRoleScope(uid: IUser['_id']): Promise<boolean> {
		const query = {
			_id: uid,
		};

<<<<<<< HEAD:apps/meteor/server/models/raw/Users.ts
		const options: FindOptions<IUser> = {
=======
		const options = {
>>>>>>> develop:apps/meteor/server/models/raw/Users.js
			projection: { _id: 1 },
		};

		const found = await this.findOne(query, options);
		return Boolean(found);
	}

	addBannerById(_id: string, banner: IBanner): Promise<UpdateResult> {
		const query = {
			_id,
			[`banners.${banner._id}.read`]: {
				$ne: true,
			},
		};

		const update = {
			$set: {
				[`banners.${banner._id}`]: banner,
			},
		};

		return this.updateOne(query, update);
	}

	// Voip functions
	findOneByAgentUsername(username: ILivechatAgent['username'], options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null> {
		const query = { username, roles: 'livechat-agent' };

		return this.findOne(query, options);
	}

	findOneByExtension(extension: string, options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null> {
		const query = {
			extension,
		};

		return this.findOne(query, options);
	}

	findByExtensions(extensions: string[], options: FindOptions<ILivechatAgent>): FindCursor<ILivechatAgent> {
		const query = {
			extension: {
				$in: extensions,
			},
		};

		return this.find(query, options);
	}

	getVoipExtensionByUserId(agentId: ILivechatAgent['_id'], options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null> {
		const query = {
			_id: agentId,
			extension: { $exists: true },
		};
		return this.findOne(query, options);
	}

	setExtension(agentId: ILivechatAgent['_id'], extension: string): Promise<UpdateResult> {
		const query = {
			_id: agentId,
		};

		const update: UpdateFilter<IUser> = {
			$set: {
				extension,
			},
		};
		return this.updateOne(query, update);
	}

	unsetExtension(agentId: ILivechatAgent['_id']): Promise<UpdateResult> {
		const query: Filter<ILivechatAgent> = {
			_id: agentId,
		};
		const update: UpdateFilter<ILivechatAgent> = {
			$unset: {
				extension: true,
			},
		};
		return this.updateOne(query as any, update);
	}

	getAvailableAgentsIncludingExt(
		includeExt: string,
		text: string,
		options: FindOptions<ILivechatAgent>,
	): FindPaginated<FindCursor<WithId<ILivechatAgent>>> {
		const query: Filter<ILivechatAgent> = {
			roles: { $in: ['livechat-agent'] },
			$and: [
				...(text && text.trim()
					? [{ $or: [{ username: new RegExp(escapeRegExp(text), 'i') }, { name: new RegExp(escapeRegExp(text), 'i') }] }]
					: []),
				{ $or: [{ extension: { $exists: false } }, ...(includeExt ? [{ extension: includeExt }] : [])] },
			],
		};

		return this.findPaginated(query as any, options);
	}

	findActiveUsersTOTPEnable(options: FindOptions<IUser>): FindCursor<IUser> {
		const query: Filter<IUser> = {
			'active': true,
			'services.totp.enabled': true,
		};
		return this.find(query, options);
	}

	findActiveUsersEmail2faEnable(options: FindOptions<IUser>): FindCursor<IUser> {
		const query: Filter<IUser> = {
			'active': true,
			'services.email2fa.enabled': true,
		};
		return this.find(query, options);
	}

	setAsFederated(uid: IUser['_id']) {
		const query = {
			_id: uid,
		};

		const update = {
			$set: {
				federated: true,
			},
		};
		return this.updateOne(query, update);
	}

	removeRoomByRoomId(rid) {
		return this.updateMany(
			{
				__rooms: rid,
			},
			{
				$pull: { __rooms: rid },
			},
		);
	}

	findOneByResetToken(token, options) {
		return this.findOne({ 'services.password.reset.token': token }, options);
	}
}

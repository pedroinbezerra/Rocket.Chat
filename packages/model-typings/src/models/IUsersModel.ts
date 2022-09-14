import type { Document, Filter, FindCursor, FindOptions, UpdateResult, WithId } from 'mongodb';
import type {
	IBanner,
	ILivechatAgent,
	ILivechatAgentStatus,
	ILivechatBusinessHour,
	ILivechatDepartment,
	IRole,
	IRoom,
	IUser,
	UserStatus,
} from '@rocket.chat/core-typings';
import type { PaginatedRequest } from '@rocket.chat/rest-typings';

import type { FindPaginated, IBaseModel } from './IBaseModel';

export interface IUsersModel extends IBaseModel<IUser> {
	addRolesByUserId(uid: IUser['_id'], roles: IRole['_id'][]): Promise<UpdateResult>;

	findUsersInRoles(roles: IRole['_id'][] | IRole['_id'], scope?: null, options?: FindOptions<IUser>): FindCursor<IUser>;

	findOneByUsername(username: IUser['username'], options?: FindOptions<IUser>): Promise<IUser | null>;

	findOneAgentById(_id: ILivechatAgent['_id'], options?: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null>;

	findUsersInRolesWithQuery(roles: IRole['_id'] | IRole['_id'][], query: Filter<IUser>, options?: FindOptions<IUser>): FindCursor<IUser>;

	findOneByUsernameAndRoomIgnoringCase(
		username: IUser['username'] | RegExp,
		rid: IRoom['_id'],
		options?: FindOptions<IUser>,
	): Promise<IUser | null>;

	findOneByIdAndLoginHashedToken(_id: IUser['_id'], token: any, options?: FindOptions<IUser>): Promise<IUser | null>;

	findByActiveUsersExcept(
		searchTerm: string,
		exceptions: IUser['username'][] | IUser['username'],
		options: FindOptions<IUser>,
		searchFields: any,
		extraQuery: any[],
		params: { startsWith?: boolean; endsWith?: boolean },
	): FindCursor<IUser>;

	findActive(query: Filter<IUser>, options?: FindOptions<IUser>): FindCursor<IUser>;

	findActiveByIds(userIds: IUser['_id'][], options?: FindOptions<IUser>): FindCursor<IUser>;

	findByIds(userIds: IUser['_id'][], options?: FindOptions<IUser>): FindCursor<IUser>;

	findOneByUsernameIgnoringCase(username: IUser['username'], options: FindOptions<IUser>): Promise<IUser | null>;

	findOneByLDAPId(id: string, attribute?: any): Promise<IUser | null>;

	findOneByAppId(appId: string, options?: FindOptions<IUser>): Promise<IUser | null>;

	findLDAPUsers(options?: FindOptions<IUser>): FindCursor<IUser>;

	findConnectedLDAPUsers(options?: FindOptions<IUser>): FindCursor<IUser>;

	isUserInRole(userId: IUser['_id'], roleId: IRole['_id']): Promise<boolean>;

	getDistinctFederationDomains(): Promise<any>;

	getNextLeastBusyAgent(
		department: ILivechatDepartment['_id'],
		ignoreAgentId: ILivechatAgent['_id'],
	): Promise<{
		agentId: ILivechatAgent['_id'];
		username: ILivechatAgent['username'];
		lastRoutingTime: ILivechatAgent['lastRoutingTime'];
		departments: ILivechatDepartment['_id'][];
		count: number;
	} | null>;

	getLastAvailableAgentRouted(
		department: ILivechatDepartment['_id'],
		ignoreAgentId: ILivechatAgent['_id'],
	): Promise<{
		agentId: ILivechatAgent['_id'];
		username: ILivechatAgent['username'];
		lastRoutingTime: ILivechatAgent['lastRoutingTime'];
		departments: ILivechatDepartment['_id'][];
	} | null>;

	setLastRoutingTime(userId: IUser['_id']): Promise<WithId<IUser> | null>;

	setLivechatStatusIf(
		userId: ILivechatAgent['_id'],
		status: ILivechatAgentStatus,
		conditions: any,
		extraFields: any,
	): Promise<UpdateResult>;

	getAgentAndAmountOngoingChats(userId: IUser['_id']): Promise<{
		'agentId': ILivechatAgent['_id'];
		'username': ILivechatAgent['username'];
		'lastAssignTime': ILivechatAgent['lastAssignTime'];
		'lastRoutingTime': ILivechatAgent['lastRoutingTime'];
		'queueInfo.chats': number;
	} | null>;

	findAllResumeTokensByUserId(userId: IUser['_id']): Promise<{ _id: IUser['_id']; tokens: string[] } | null>;

	findActiveByUsernameOrNameRegexWithExceptionsAndConditions(
		termRegex: RegExp,
		exceptions?: string[] | string,
		conditions?: string[],
		options?: FindOptions<IUser>,
	): FindCursor<IUser>;

	countAllAgentsStatus({ departmentId }: { departmentId?: ILivechatDepartment['_id'] }): Promise<{
		_id: null;
		offline: number;
		away: number;
		busy: number;
		available: number;
	} | null>;

	getTotalOfRegisteredUsersByDate({ start, end, options }: { start: Date; end: Date; options?: PaginatedRequest }): Promise<
		{
			date: string;
			users: number;
			type: 'users';
		}[]
	>;

	getUserLanguages(): Promise<{ _id: string; total: number } | null>;

	updateStatusText(_id: IUser['_id'], statusText: string): Promise<UpdateResult>;

	updateStatusByAppId(appId: string, status: UserStatus): Promise<UpdateResult>;

	openAgentsBusinessHoursByBusinessHourId(businessHourIds: ILivechatBusinessHour['_id'][]): Promise<Document | UpdateResult>;

	openAgentBusinessHoursByBusinessHourIdsAndAgentId(
		businessHourIds: ILivechatBusinessHour['_id'][],
		agentId: ILivechatAgent['_id'],
	): Promise<UpdateResult | Document>;

	addBusinessHourByAgentIds(
		agentIds: ILivechatAgent['_id'][],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<UpdateResult | Document>;

	removeBusinessHourByAgentIds(
		agentIds: ILivechatAgent['_id'][],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<UpdateResult | Document>;

	openBusinessHourToAgentsWithoutDepartment(
		agentIdsWithDepartment: ILivechatDepartment['_id'][],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<UpdateResult | Document>;

	closeBusinessHourToAgentsWithoutDepartment(
		agentIdsWithDepartment: ILivechatAgent['_id'][],
		businessHourId: ILivechatBusinessHour['_id'],
	): Promise<UpdateResult | Document>;

	closeAgentsBusinessHoursByBusinessHourIds(businessHourIds: ILivechatBusinessHour['_id'][]): Promise<UpdateResult | Document>;

	updateLivechatStatusBasedOnBusinessHours(agentIds: ILivechatAgent['_id'][]): Promise<UpdateResult | Document>;

	setLivechatStatusActiveBasedOnBusinessHours(agentId: IUser['_id']): Promise<UpdateResult>;

	isAgentWithinBusinessHours(agentId: ILivechatAgent['_id']): Promise<boolean>;

	removeBusinessHoursFromAllUsers(): Promise<UpdateResult | Document>;

	resetTOTPById(userId: IUser['_id']): Promise<UpdateResult>;

	unsetLoginTokens(userId: IUser['_id']): Promise<UpdateResult>;

	removeNonPATLoginTokensExcept(userId: IUser['_id'], authToken: string): Promise<UpdateResult>;

	removeRoomsByRoomIdsAndUserId(rids: any, userId: IUser['_id']): Promise<UpdateResult>;

	removeRolesByUserId(uid: IUser['_id'], roles: IRole['_id'][]): Promise<UpdateResult>;

	isUserInRoleScope(uid: IUser['_id']): Promise<boolean>;

	addBannerById(_id: string, banner: IBanner): Promise<UpdateResult>;

	findOneByAgentUsername(username: ILivechatAgent['username'], options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null>;

	findOneByExtension(extension: string, options?: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null>;

	findByExtensions(extensions: string[], options?: FindOptions<ILivechatAgent>): FindCursor<ILivechatAgent>;

	getVoipExtensionByUserId(userId: IUser['_id'], options: FindOptions<ILivechatAgent>): Promise<ILivechatAgent | null>;

	setExtension(userId: IUser['_id'], extension: string): Promise<UpdateResult>;

	unsetExtension(userId: IUser['_id']): Promise<UpdateResult>;

	getAvailableAgentsIncludingExt(
		includeExt: string,
		text: string,
		options: FindOptions<ILivechatAgent>,
	): FindPaginated<FindCursor<WithId<ILivechatAgent>>>;

	findActiveUsersTOTPEnable(options: FindOptions<IUser>): FindCursor<IUser>;

	findActiveUsersEmail2faEnable(options: FindOptions<IUser>): FindCursor<IUser>;

	findActiveByIdsOrUsernames(userIds: IUser['_id'][], options?: FindOptions<IUser>): FindCursor<IUser>;

	setAsFederated(userId: IUser['_id']): Promise<UpdateResult>;

	removeRoomByRoomId(rid: any): any;

	findOneByResetToken(token: string, options: FindOptions<IUser>): Promise<IUser | null>;
}

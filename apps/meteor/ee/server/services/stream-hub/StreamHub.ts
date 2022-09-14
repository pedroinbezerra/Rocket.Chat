import type { ISetting, IUser, RocketChatRecordDeleted } from '@rocket.chat/core-typings';
import type { Collection } from 'mongodb';

import type { IServiceClass } from '../../../../server/sdk/types/ServiceClass';
import { ServiceClass } from '../../../../server/sdk/types/ServiceClass';
import { getConnection } from '../mongo';
import { initWatchers } from '../../../../server/modules/watchers/watchers.module';
import { api } from '../../../../server/sdk/api';
import { DatabaseWatcher } from '../../../../server/database/DatabaseWatcher';

export class StreamHub extends ServiceClass implements IServiceClass {
	protected name = 'hub';

	async created(): Promise<void> {
		const db = await getConnection({ maxPoolSize: 1 });

		const watcher = new DatabaseWatcher({ db });

		const Rooms = new RoomsRaw(db, Trash);
		const Settings = new SettingsRaw(db, Trash as unknown as Collection<RocketChatRecordDeleted<ISetting>>);
		const Users = new UsersRaw(db, Trash as unknown as Collection<RocketChatRecordDeleted<IUser>>);
		const UsersSessions = new UsersSessionsRaw(db);
		const Subscriptions = new SubscriptionsRaw(db);
		const LivechatInquiry = new LivechatInquiryRaw(db);
		const LivechatDepartmentAgents = new LivechatDepartmentAgentsRaw(db);
		const Messages = new MessagesRaw(db);
		const Permissions = new PermissionsRaw(db);
		const Roles = new RolesRaw(db);
		const LoginServiceConfiguration = new LoginServiceConfigurationRaw(db);
		const InstanceStatus = new InstanceStatusRaw(db);
		const IntegrationHistory = new IntegrationHistoryRaw(db);
		const Integrations = new IntegrationsRaw(db);
		const EmailInbox = new EmailInboxRaw(db);
		const PbxEvents = new PbxEventsRaw(db);
		initWatchers(watcher, api.broadcast.bind(api));

		watcher.watch();
	}
}

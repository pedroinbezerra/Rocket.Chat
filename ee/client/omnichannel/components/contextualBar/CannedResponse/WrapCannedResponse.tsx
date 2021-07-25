import React, { FC, memo, MouseEvent, MouseEventHandler } from 'react';

import { usePermission } from '../../../../../../client/contexts/AuthorizationContext';
import { useSetModal } from '../../../../../../client/contexts/ModalContext';
import { IOmnichannelRoom } from '../../../../../../definition/IRoom';
import CreateCannedResponse from '../../CannedResponse/modals';
import CannedResponse from './CannedResponse';

const WrapCannedResponse: FC<{
	cannedItem: any;
	onClickBack: MouseEventHandler<HTMLOrSVGElement>;
	onClickUse: (e: MouseEvent<HTMLOrSVGElement>, text: string) => void;
	reload: () => void;
	room: IOmnichannelRoom;
}> = ({
	cannedItem: { _id, departmentName, departmentId, shortcut, tags, scope, text },
	onClickBack,
	onClickUse,
	reload,
	room,
}) => {
	const setModal = useSetModal();
	const onClickEdit = (): void => {
		setModal(
			<CreateCannedResponse
				data={{ _id, departmentId, shortcut, tags, scope, text }}
				reloadCannedList={reload}
				room={room}
			/>,
		);
	};

	const hasManagerPermission = usePermission('view-all-canned-responses');

	const canEdit = hasManagerPermission || scope === 'user';

	return (
		<CannedResponse
			canEdit={canEdit}
			data={{
				departmentName,
				shortcut,
				tags,
				scope,
				text,
			}}
			onClickBack={onClickBack}
			onClickEdit={onClickEdit}
			onClickUse={(e): void => {
				onClickUse(e, text);
			}}
		/>
	);
};

export default memo(WrapCannedResponse);

import { Action } from 'shared/ReactTypes';
import { Dispatch } from 'react/src/currentDispatch';
import { Lane } from './fiberLanes';
import { Update } from './fiberFlags';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<State> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(action: Action<State>, lane: Lane) => {
	return {
		action,
		lane,
		next: null
	};
};

export const createUpdateQueue = <Action>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<Action>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;

	if (pending === null) {
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}

	updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};

	if (pendingUpdate !== null) {
		let first = pendingUpdate.next;
		let pending = first as Update<any>;

		do {
			const updateLane = pending.lane;

			if (updateLane === renderLane) {
				const action = pendingUpdate.action;

				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					baseState = action;
				}
			} else {
				if (__DEV__) {
					console.error('不应该进入');
				}
			}

			pending = pending.next as Update<any>;
		} while (pending !== first);
	}

	result.memoizedState = baseState;

	return result;
};

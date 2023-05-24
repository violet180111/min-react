import { FiberNode } from './fiber';
import { HostComponent, HostRoot, HostText } from './workTag';
import { processUpdateQueue } from './updateQueue';
import type { ReactElement } from 'shared/ReactTypes';
import type { UpdateQueue } from './updateQueue';
import {
	mountReconcileChildFibers,
	updateReconcileChildFibers
} from './childFibers';

function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;

	updateQueue.shared.pending = null;

	const { memoizedState } = processUpdateQueue(baseState, pending);

	wip.memoizedState = memoizedState;

	const nextChild = wip.memoizedState;

	reconcileChildren(wip, nextChild);

	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChild = nextProps.children;

	reconcileChildren(wip, nextChild);

	return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElement) {
	const current = wip.alternate;

	if (current) {
		wip.child = updateReconcileChildFibers(wip, current?.child, children);
	} else {
		wip.child = mountReconcileChildFibers(wip, null, children);
	}
}

export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		default:
			if (__DEV__) {
				console.log('beginWork 未实现的类型');
			}
			return null;
	}
};
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';
import { processUpdateQueue } from './updateQueue';
import type { ReactElement } from 'shared/ReactTypes';
import type { UpdateQueue } from './updateQueue';
import {
	mountReconcileChildFibers,
	updateReconcileChildFibers
} from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;

	updateQueue.shared.pending = null;

	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);

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

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChild = renderWithHooks(wip, renderLane);

	reconcileChildren(wip, nextChild);

	return wip.child;
}

function updateFragment(wip: FiberNode) {
	const nextChild = wip.pendingProps;

	reconcileChildren(wip, nextChild);

	return wip.child;
}

function reconcileChildren(wip: FiberNode, children: any) {
	const current = wip.alternate;

	if (current) {
		wip.child = updateReconcileChildFibers(wip, current?.child, children);
	} else {
		wip.child = mountReconcileChildFibers(wip, null, children);
	}
}

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	if (__DEV__) {
		console.info('beginWork', wip);
	}

	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		default:
			if (__DEV__) {
				console.log('beginWork 未实现的类型');
			}
			return null;
	}
};

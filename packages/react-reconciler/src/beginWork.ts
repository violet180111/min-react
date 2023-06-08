import { FiberNode } from './fiber';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { processUpdateQueue } from './updateQueue';
import type { UpdateQueue } from './updateQueue';
import {
	mountReconcileChildFibers,
	updateReconcileChildFibers
} from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane, Lanes } from './fiberLanes';
import { Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';

function updateHostRoot(workInProgress: FiberNode, renderLanes: Lanes) {
	const baseState = workInProgress.memoizedState;
	const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;

	updateQueue.shared.pending = null;

	const { memoizedState } = processUpdateQueue(baseState, pending, renderLanes);

	workInProgress.memoizedState = memoizedState;

	const nextChild = workInProgress.memoizedState;

	reconcileChildren(workInProgress, nextChild, renderLanes);

	return workInProgress.child;
}

function updateHostComponent(workInProgress: FiberNode, renderLanes: Lanes) {
	const nextProps = workInProgress.pendingProps;
	const nextChild = nextProps.children;

	markRef(workInProgress.alternate, workInProgress);
	reconcileChildren(workInProgress, nextChild, renderLanes);

	return workInProgress.child;
}

function updateFunctionComponent(
	workInProgress: FiberNode,
	renderLanes: Lanes
) {
	const nextChild = renderWithHooks(workInProgress, renderLanes);

	reconcileChildren(workInProgress, nextChild, renderLanes);

	return workInProgress.child;
}

function updateFragment(workInProgress: FiberNode, renderLanes: Lanes) {
	const nextChild = workInProgress.pendingProps;

	reconcileChildren(workInProgress, nextChild, renderLanes);

	return workInProgress.child;
}

function updateContextProvider(workInProgress: FiberNode, renderLanes: Lanes) {
	const provider = workInProgress.type;
	const context = provider._context;
	const oldProps = workInProgress.memoizedProps;
	const newProps = workInProgress.pendingProps;
	const newValue = newProps.value;

	if (__DEV__ && !('value' in newProps)) {
		console.error('<Context.Provider /> 需要 value props');
	}

	pushProvider(context, newValue);

	const nextChild = newProps.children;

	reconcileChildren(workInProgress, nextChild, renderLanes);

	return workInProgress.child;
}

function reconcileChildren(
	workInProgress: FiberNode,
	children: any,
	lanes: Lanes
) {
	const current = workInProgress.alternate;

	if (current) {
		workInProgress.child = updateReconcileChildFibers(
			workInProgress,
			current?.child,
			children,
			lanes
		);
	} else {
		workInProgress.child = mountReconcileChildFibers(
			workInProgress,
			null,
			children,
			lanes
		);
	}
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;

	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}

export const beginWork = (workInProgress: FiberNode, renderLanes: Lanes) => {
	if (__DEV__) {
		console.log('beginWork', workInProgress);
	}

	switch (workInProgress.tag) {
		case HostRoot:
			return updateHostRoot(workInProgress, renderLanes);
		case HostComponent:
			return updateHostComponent(workInProgress, renderLanes);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(workInProgress, renderLanes);
		case Fragment:
			return updateFragment(workInProgress, renderLanes);
		case ContextProvider:
			return updateContextProvider(workInProgress, renderLanes);
		default:
			if (__DEV__) {
				console.log('beginWork 未实现的类型');
			}
			return null;
	}
};

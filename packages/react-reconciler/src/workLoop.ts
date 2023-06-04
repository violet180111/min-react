import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTag';
import { commitMutationEffects } from './commitWork';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { scheduleMicroTask } from 'hostConfig';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import type { FiberNode, FiberRootNode } from './fiber';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;

export function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

export function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = fiber.return;

	while (parent) {
		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}

	return null;
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateFromFiberToRoot(fiber);

	markRootUpdated(root, lane);

	ensureRootIsScheduled(root);
}

export function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);

	if (updateLane === NoLane) {
		return;
	}

	if (updateLane === SyncLane) {
		if (__DEV__) {
			console.log('在微任务中调度，优先级：', updateLane);
		}

		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));

		scheduleMicroTask(flushSyncCallbacks);
	} else {
	}
}
export function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);

		return;
	}

	if (__DEV__) {
		console.log('render 阶段开始');
	}

	prepareFreshStack(root, lane);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.error('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;

	root.finishedWork = finishedWork;
	root.finishLane = lane;

	wipRootRenderLane = NoLane;

	commitRoot(root);
}

export function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.info('commit 阶段开始', finishedWork);
	}

	const lane = root.finishLane;

	root.finishedWork = null;
	root.finishLane = NoLane;

	markRootFinished(root, lane);

	if (lane === NoLane && __DEV__) {
		console.error('commit 阶段 finishedLane 不应该是 NoLane');
	}

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		root.current = finishedWork;

		// beforeMutation

		// Mutation
		commitMutationEffects(finishedWork);
		// layout
	} else {
	}
}

export function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

export function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane);

	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

export function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);

		const sibling = node.sibling;

		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}

		node = node.return;
		workInProgress = node;
	} while (node !== null);
}

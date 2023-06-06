import {
	unstable_NormalPriority as NormalPriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield
} from 'scheduler';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { PendingPassiveEffects, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import { HostRoot } from './workTags';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitMutationEffects
} from './commitWork';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { scheduleMicroTask } from 'hostConfig';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import type { FiberNode, FiberRootNode } from './fiber';
import { HookHasEffect, Passive } from './hookEffectTags';

type RootStatus = number;

const RootInCompleted: RootStatus = 1;
const RootCompleted: RootStatus = 2;

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

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
		const schedulePriority = lanesToSchedulerPriority(updateLane);

		scheduleCallback(
			schedulePriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
}
export function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);

		return;
	}

	const exitStatus = renderRoot(root, nextLane, false);

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;

		root.finishedWork = finishedWork;
		root.finishLane = nextLane;

		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新的结束状态');
	}
}

export function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const nextLane = getHighestPriorityLane(root.pendingLanes);
	const curCallbackNode = root.callbackNode;

	if (nextLane === NoLane) {
		return null;
	}

	const needSync = nextLane === SyncLane || didTimeout;

	const exitStatus = renderRoot(root, nextLane, !needSync);

	ensureRootIsScheduled(root);

	if (exitStatus === RootInCompleted) {
		if (root.callbackNode !== curCallbackNode) {
			return null;
		}

		return performConcurrentWorkOnRoot.bind(null, root);
	}

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;

		root.finishedWork = finishedWork;
		root.finishLane = nextLane;

		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现并发更新的结束状态');
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.info(`开始 ${shouldTimeSlice ? '并发' : '同步'}`);
	}

	if (wipRootRenderLane !== lane) {
		prepareFreshStack(root, lane);
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.error('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	if (shouldTimeSlice && workInProgress !== null) {
		return RootInCompleted;
	}

	if (shouldTimeSlice && workInProgress === null && __DEV__) {
		console.error('render 阶段执行完 workInProgress 不应该为 null');
	}

	return RootCompleted;
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	pendingPassiveEffects.unmount.forEach((effect) => {
		commitHookEffectListUnmount(Passive, effect);
	});

	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update = [];

	flushSyncCallbacks();
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

	if (lane === NoLane && __DEV__) {
		console.error('commit 阶段 finishedLane 不应该是 NoLane');
	}

	root.finishedWork = null;
	root.finishLane = NoLane;

	markRootFinished(root, lane);
	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;

			scheduleCallback(NormalPriority, () => {
				flushPassiveEffects(root.pendingPassiveEffects);

				return;
			});
		}
	}

	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags;
	const rootHasEffect =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		root.current = finishedWork;

		// beforeMutation

		// Mutation
		commitMutationEffects(finishedWork, root);
		// layout
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;

	ensureRootIsScheduled(root);
}

export function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

export function workLoopConcurrent() {
	while (workInProgress !== null && !shouldYield()) {
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

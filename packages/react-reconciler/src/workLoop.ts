import {
	unstable_NormalPriority as NormalPriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	unstable_cancelCallback as cancelCallback,
	CallbackNode
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
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import {
	Lane,
	Lanes,
	NoLane,
	NoLanes,
	SyncLane,
	getHighestPriorityLane,
	includesBlockingLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { scheduleMicroTask } from 'hostConfig';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import type { FiberNode, FiberRootNode } from './fiber';
import { HookHasEffect, Passive } from './hookEffectTags';

type ExecutionContext = number;
export const NoContext = /*             */ 0b0000;
// const BatchedContext = /*               */ 0b0001;
const RenderContext = /*                */ 0b0010;
const CommitContext = /*                */ 0b0100;
let executionContext: ExecutionContext = NoContext;

type RootStatus = number;

const RootInCompleted: RootStatus = 1;
const RootCompleted: RootStatus = 2;

let workInProgress: FiberNode | null = null;
let workInProgressRootRenderLane: Lanes = NoLanes;
let rootDoesHasPassiveEffects = false;

export function prepareFreshStack(root: FiberRootNode, lanes: Lanes) {
	root.finishLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	workInProgressRootRenderLane = lanes;
}

export function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
	let node = fiber;
	let parent = fiber.return;

	node.lanes = mergeLanes(node.lanes, lane);

	const alternate = node.alternate;

	if (alternate) {
		alternate.lanes = mergeLanes(alternate.lanes, lane);
	}

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
	const root = markUpdateLaneFromFiberToRoot(fiber, lane);

	markRootUpdated(root, lane);

	ensureRootIsScheduled(root);
}

export function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		if (existingCallback) {
			cancelCallback(existingCallback);
		}

		root.callbackNode = null;
		root.callbackPriority = NoLane;

		return;
	}

	const prevPriority = root.callbackPriority;
	const curPriority = updateLane;

	if (prevPriority == curPriority) {
		return;
	}

	if (existingCallback) {
		cancelCallback(existingCallback);
	}

	let newCallback: CallbackNode | null = null;

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`,
			updateLane
		);
	}

	if (updateLane === SyncLane) {
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));

		scheduleMicroTask(flushSyncCallbacks);
	} else {
		const schedulePriority = lanesToSchedulerPriority(updateLane);

		newCallback = scheduleCallback(
			schedulePriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallback;
	root.callbackPriority = curPriority;
}

export function performSyncWorkOnRoot(root: FiberRootNode) {
	if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
		throw '当前不应处于React工作流程内';
	}

	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);

		return;
	}

	const exitStatus = renderRootSync(root, nextLane);

	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;

		root.finishedWork = finishedWork;
		root.finishLane = nextLane;

		workInProgressRootRenderLane = NoLanes;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新的结束状态');
	}
}

export function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
		throw '当前不应处于React工作流程内';
	}

	const curCallbackNode = root.callbackNode;

	const didFlushPassiveEffects = flushPassiveEffects(
		root.pendingPassiveEffects
	);

	if (didFlushPassiveEffects) {
		if (curCallbackNode !== root.callbackNode) {
			return null;
		}
	}

	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane === NoLane) {
		return null;
	}

	const shouldTimeSlice = !includesBlockingLane(root, nextLane) && !didTimeout;

	const exitStatus = shouldTimeSlice
		? renderRootConcurrent(root, nextLane)
		: renderRootSync(root, nextLane);

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

		workInProgressRootRenderLane = NoLanes;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现并发更新的结束状态');
	}
}

function renderRootSync(root: FiberRootNode, lanes: Lanes) {
	if (__DEV__) {
		console.info(`开始同步更新`);
	}

	const prevExecutionContext = executionContext;

	executionContext |= RenderContext;

	if (workInProgressRootRenderLane !== lanes) {
		prepareFreshStack(root, lanes);
	}

	do {
		try {
			workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.error('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	executionContext = prevExecutionContext;

	workInProgressRootRenderLane = NoLane;

	return RootCompleted;
}

function renderRootConcurrent(root: FiberRootNode, lanes: Lanes) {
	if (__DEV__) {
		console.info(`开始并发更新`);
	}

	const prevExecutionContext = executionContext;

	executionContext |= RenderContext;

	if (workInProgressRootRenderLane !== lanes) {
		prepareFreshStack(root, lanes);
	}

	do {
		try {
			workLoopConcurrent();
			break;
		} catch (e) {
			if (__DEV__) {
				console.error('workLoop发生错误', e);
			}

			workInProgress = null;
		}
	} while (true);

	executionContext = prevExecutionContext;

	if (workInProgress !== null) {
		return RootInCompleted;
	}

	if (workInProgress !== null && __DEV__) {
		console.error('render 阶段执行完 workInProgress 不应该为 null');
	}

	workInProgressRootRenderLane = NoLane;

	return RootCompleted;
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
		console.error('不能在React工作流程内执行useEffect回调');
	}

	let didFlushPassiveEffects = false;

	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffects = true;

		commitHookEffectListUnmount(Passive, effect);
	});

	pendingPassiveEffects.unmount = [];

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;

		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;

		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update = [];

	flushSyncCallbacks();

	return didFlushPassiveEffects;
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
		const prevExecutionContext = executionContext;

		executionContext |= CommitContext;

		root.current = finishedWork;

		// beforeMutation

		// Mutation
		commitMutationEffects(finishedWork, root);

		root.current = finishedWork;

		// layout
		commitLayoutEffects(finishedWork, root);

		executionContext = prevExecutionContext;
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
	const next = beginWork(fiber, workInProgressRootRenderLane);

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

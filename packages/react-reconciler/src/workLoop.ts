import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTag';
import type { FiberNode, FiberRootNode } from './fiber';
import { commitMutationEffects } from './commitWork';
import { Lane, getHighestPriorityLane, mergeLanes } from './fiberLanes';

let workInProgress: FiberNode | null = null;

export function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
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

	ensureRootIsSchedule(root);
}

export function ensureRootIsSchedule(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
}

export function renderRoot(root: FiberRootNode) {
	prepareFreshStack(root);

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

	root.finishedWork = null;
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
	const next = beginWork(fiber);

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

import { Flags, NoFlags } from './fiberFlags';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { REACT_FRAGMENT_TYPE, REACT_PROVIDER_TYPE } from 'shared/ReactSymbols';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import type { CallbackNode } from 'scheduler';
import type { Container } from 'hostConfig';
import type { Props, Key, Ref, ReactElement } from 'shared/ReactTypes';
import { Effect } from './fiberHooks';

export class FiberNode {
	tag: WorkTag;
	key: Key;
	stateNode: any;
	type: any;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	ref: Ref;

	pendingProps: Props;
	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	lanes: Lanes;
	// childLanes: Lanes

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key ?? null;
		this.stateNode = null;
		this.type = null;

		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.updateQueue = null;

		this.alternate = null;
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;

		// 调度
		this.lanes = NoLanes;
		//this.childLanes = NoLanes
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;
	finishLane: Lane;
	pendingLanes: Lanes;
	pendingPassiveEffects: PendingPassiveEffects;
	callbackNode: CallbackNode | null;
	callbackPriority: Lane;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;

		hostRootFiber.stateNode = this;

		this.finishedWork = null;
		this.finishLane = NoLane;
		this.pendingLanes = NoLanes;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
		this.callbackNode = null;
		this.callbackPriority = NoLane;
	}
}

export function createWorkInProgress(
	current: FiberNode,
	pendingProps: Props
): FiberNode {
	let workInProgress = current.alternate;

	if (workInProgress === null) {
		workInProgress = new FiberNode(current.tag, pendingProps, current.key);
		workInProgress.stateNode = current.stateNode;

		workInProgress.alternate = current;
		current.alternate = workInProgress;
	} else {
		workInProgress.pendingProps = pendingProps;
		workInProgress.flags = NoFlags;
		workInProgress.subtreeFlags = NoFlags;
		workInProgress.deletions = null;
	}

	workInProgress.type = current.type;
	workInProgress.updateQueue = current.updateQueue;
	workInProgress.child = current.child;
	workInProgress.flags = current.flags;

	workInProgress.memoizedProps = current.memoizedProps;
	workInProgress.memoizedState = current.memoizedState;
	workInProgress.ref = current.ref;

	return workInProgress;
}

export function createFiberFromElement(element: ReactElement, lanes: Lanes) {
	const { type, key, props, ref } = element;
	let tag: WorkTag = FunctionComponent;

	if (type === REACT_FRAGMENT_TYPE) {
		return createFiberFromFragment(props.children, lanes, key);
	}

	if (typeof type === 'string') {
		tag = HostComponent;
	} else if (
		typeof type === 'object' &&
		type.$$typeof === REACT_PROVIDER_TYPE
	) {
		tag = ContextProvider;
	} else if (typeof type !== 'function' && __DEV__) {
		console.error('未实现的type类型', element);
	}

	const fiber = new FiberNode(tag, props, key);

	fiber.type = type;
	fiber.lanes = lanes;
	fiber.ref = ref;

	return fiber;
}

export function createFiberFromFragment(
	elements: any[],
	lanes: Lanes,
	key: Key
): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);

	fiber.lanes = lanes;

	return fiber;
}

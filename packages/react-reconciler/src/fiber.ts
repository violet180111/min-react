import { Flags, NoFlags } from './fiberFlags';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
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
	let wip = current.alternate;

	if (wip === null) {
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
}

export function createFiberFromElement(element: ReactElement) {
	const { type, key, props } = element;
	let tag: WorkTag = FunctionComponent;

	if (type === REACT_FRAGMENT_TYPE) {
		return createFiberFromFragment(props.children, key);
	}

	if (typeof type === 'string') {
		tag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.error('未实现的type类型', element);
	}

	const fiber = new FiberNode(tag, props, key);

	fiber.type = type;

	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);

	return fiber;
}

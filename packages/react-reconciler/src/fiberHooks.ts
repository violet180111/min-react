import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { Dispatcher, Dispatch } from 'react/src/currentDispatch';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLanes } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

export interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | null;
	destroy: EffectCallback | null;
	deps: EffectDeps;
	next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

const { currentDispatcher } = internals;

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const HookDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect
};

const HookDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect
};

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;

	renderLane = lane;

	const current = wip.alternate;

	if (current) {
		currentDispatcher.current = HookDispatcherOnUpdate;
	} else {
		currentDispatcher.current = HookDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;

	const children = Component(props);

	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;

	return children;
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	const hook = mountWorkInProgressHook();

	let memorizedState;

	if (initialState instanceof Function) {
		memorizedState = initialState();
	} else {
		memorizedState = initialState;
	}

	const queue = createUpdateQueue<State>();

	hook.updateQueue = queue;

	// @ts-ignore
	const dispatch: Dispatch<State> = (queue.dispatch = dispatchSetState.bind(
		null,
		currentlyRenderingFiber as FiberNode,
		queue
	));

	return [memorizedState, dispatch];
}

function updateState<State>(): [State, Dispatch<State>] {
	const hook = updateWorkInProgressHook();

	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;

	queue.shared.pending = null;

	if (pending) {
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		);

		hook.memoizedState = memoizedState;
	}
	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function mountEffect(create: EffectCallback | null, deps: EffectDeps) {
	const hook = mountWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;

	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		null,
		nextDeps
	);
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | null,
	destroy: EffectCallback | null,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destroy,
		deps,
		next: null
	};

	const fiber = currentlyRenderingFiber as FiberNode;

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();

		fiber.updateQueue = updateQueue;

		effect.next = effect;

		updateQueue.lastEffect = effect;
	} else {
		const lastEffect = updateQueue.lastEffect;

		if (lastEffect === null) {
			effect.next = effect;

			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;

			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}

	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;

	updateQueue.lastEffect = null;

	return updateQueue;
}

function updateEffect() {}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLanes();
	const update = createUpdate(action, lane);

	enqueueUpdate(updateQueue, update);

	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在 FunctionComponent 中使用 hook');
		} else {
			currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
		}
	} else {
		workInProgressHook = workInProgressHook.next = hook;
	}

	return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | null = null;

	if (currentHook) {
		nextCurrentHook = currentHook.next;
	} else {
		const current = currentlyRenderingFiber?.alternate;

		if (current) {
			nextCurrentHook = current.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	}

	if (nextCurrentHook === null) {
		throw new Error('hook执行数量超出');
	}

	currentHook = nextCurrentHook;

	const newHook: Hook = {
		memoizedState: currentHook?.memoizedState,
		updateQueue: currentHook?.updateQueue,
		next: null
	};

	if (workInProgressHook === null) {
		if (currentlyRenderingFiber === null) {
			throw new Error('请在 FunctionComponent 中使用 hook');
		} else {
			currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
		}
	} else {
		workInProgressHook = workInProgressHook.next = newHook;
	}

	return workInProgressHook;
}

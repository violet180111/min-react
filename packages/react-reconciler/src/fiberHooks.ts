import { FiberNode } from './fiber';
import internals from 'shared/internals';
import currentBatchConfig from 'react/src/currentBatchConfig';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	Update
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, Lanes, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';
import type { Dispatcher, Dispatch } from 'react/src/currentDispatch';

export interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
	baseState: any;
	baseQueue: Update<any> | null;
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

type EffectCallback = () => any;
type EffectDeps = any[] | null;

const { currentDispatcher } = internals;

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLanes: Lanes = NoLane;

const HookDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useRef: mountRef,
	useTransition: mountTransition
};

const HookDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useRef: updateRef,
	useTransition: updateTransition
};

export function renderWithHooks(workInProgress: FiberNode, lane: Lane) {
	currentlyRenderingFiber = workInProgress;
	workInProgress.memoizedState = null;
	workInProgress.updateQueue = null;

	renderLanes = lane;

	const current = workInProgress.alternate;

	if (current) {
		currentDispatcher.current = HookDispatcherOnUpdate;
	} else {
		currentDispatcher.current = HookDispatcherOnMount;
	}

	const Component = workInProgress.type;
	const props = workInProgress.pendingProps;

	const children = Component(props);

	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLanes = NoLane;

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
	hook.memoizedState = memorizedState;
	hook.baseState = memorizedState;

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
	const baseState = hook.baseState;
	const pending = queue.shared.pending;
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	if (pending) {
		if (baseQueue) {
			const baseQueueFirst = baseQueue.next;
			const pendingFirst = pending.next;

			pending.next = baseQueueFirst;
			(baseQueueFirst as Update<any>).next = pendingFirst;
		}

		baseQueue = pending;
		current.baseQueue = pending;

		queue.shared.pending = null;
	}

	if (baseQueue) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLanes);

		hook.memoizedState = memoizedState;
		hook.baseQueue = newBaseQueue as Update<any>;
		hook.baseState = newBaseState;
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

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}

function updateEffect(create: EffectCallback | null, deps: EffectDeps) {
	const hook = updateWorkInProgressHook();
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | null;

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect;

		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			const prevDeps = prevEffect.deps;

			if (areHookInputsEqual(prevDeps, nextDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);

				return;
			}

			(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
			hook.memoizedState = pushEffect(
				Passive | HookHasEffect,
				create,
				destroy,
				nextDeps
			);
		}
	}
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

function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgressHook();
	const ref = { current: initialValue };

	hook.memoizedState = ref;

	return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
	const hook = updateWorkInProgressHook();

	return hook.memoizedState;
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true);

	const prevTransition = currentBatchConfig.transition;

	currentBatchConfig.transition = 1;

	callback();

	setPending(false);

	currentBatchConfig.transition = prevTransition;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setIsPending] = mountState(false);
	const hook = mountWorkInProgressHook();
	const start = startTransition.bind(null, setIsPending);

	hook.memoizedState = start;

	return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState();
	const hook = updateWorkInProgressHook();
	const start = hook.memoizedState;

	return [isPending as boolean, start];
}

function createFCUpdateQueue<State>() {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;

	updateQueue.lastEffect = null;

	return updateQueue;
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);

	enqueueUpdate(updateQueue, update);

	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		updateQueue: null,
		next: null,
		baseQueue: null,
		baseState: null
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
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
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

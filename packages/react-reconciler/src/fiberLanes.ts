import {
	unstable_NormalPriority as NormalPriority,
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_IdlePriority as IdlePriority,
	unstable_LowPriority as LowPriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_getCurrentPriorityLevel as getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from "./fiber";

export type Lane = number;
export type Lanes = number;

export const NoLane = /*               */ 0b0000000000000000000000000000000;
export const NoLanes = /*              */ 0b0000000000000000000000000000000;
export const SyncLane = /*             */ 0b0000000000000000000000000000001;
export const InputContinuousLane = /*  */ 0b0000000000000000000000000000010;
export const DefaultLane = /*          */ 0b0000000000000000000000000000100;
export const IdleLane = /*             */ 0b1000000000000000000000000000000;

export function mergeLanes(lane1: Lane, lane2: Lane): Lanes {
  return lane1 | lane2;
}

export function requestUpdateLanes() {
	const currentSchedulerPriorityLevel = getCurrentPriorityLevel();
	const updateLane = schedulerPriorityToLane(currentSchedulerPriorityLevel);

	console.info('updateLane!', updateLane);

	return updateLane;
}

export function schedulerPriorityToLane(schedulerPriority: number): Lane {
	if (schedulerPriority === ImmediatePriority) {
		return SyncLane;
	}

	if (schedulerPriority === UserBlockingPriority) {
		return InputContinuousLane;
	}

	if (schedulerPriority === NormalPriority) {
		return DefaultLane;
	}

	return NoLane;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return ImmediatePriority;
	}

	if (lane === InputContinuousLane) {
		return UserBlockingPriority;
	}

	if (lane === DefaultLane) {
		return NormalPriority;
	}

	return IdlePriority;
}

export function getHighestPriorityLane(lanes:Lanes): Lane {
  return lanes & -lanes;
}

export function isSubsetOfLanes(set:Lanes, subset: Lane) {
	return (set & subset) === subset;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}
export type Lane = number;
export type Lanes = number;

export const NoLane   = 0b0000;
export const NoLanes   = 0b0000;
export const SyncLane = 0b0001;

export function mergeLanes(lane1: Lane, lane2: Lane): Lanes {
  return lane1 | lane2;
}

export function requestUpdateLanes() {
  return SyncLane;
}

export function getHighestPriorityLane(lanes:Lanes): Lane {
  return lanes & -lanes;
}
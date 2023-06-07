import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_runWithPriority as runWithPriority
} from 'scheduler';
import { HostRoot } from './workTags';
import { scheduleUpdateOnFiber } from './workLoop';
import { createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue';
import { FiberNode, FiberRootNode } from './fiber';
import type { Container } from './hostConfig';
import type { ReactElement } from 'shared/ReactTypes';
import type { UpdateQueue } from './updateQueue';
import { requestUpdateLane } from './fiberLanes';

export function createContainer(container: Container) {
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	const fiberRoot = new FiberRootNode(container, hostRootFiber);

	hostRootFiber.updateQueue = createUpdateQueue<ReactElement>();

	return fiberRoot;
}

export function updateContainer(
	element: ReactElement | null,
	root: FiberRootNode
) {
	runWithPriority(ImmediatePriority, () => {
		const hostRootFiber = root.current;
		const lane = requestUpdateLane();
		const update = createUpdate<ReactElement | null>(element, lane);

		enqueueUpdate(
			hostRootFiber.updateQueue as UpdateQueue<ReactElement | null>,
			update
		);

		console.info('开始更新流程');

		scheduleUpdateOnFiber(hostRootFiber, lane);
	});

	return element;
}

import {
	appendInitialChild,
	createInstance,
	createTextInstance,
	finalizeInitialChildren
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Update } from './fiberFlags';
import { Container } from './hostConfig';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

export const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update;
};

export const completeWork = (wip: FiberNode) => {
	if (__DEV__) {
		console.info('completeWork', wip);
	}

	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				updateFiberProps(wip.stateNode, newProps);
			} else {
				const instance = createInstance(wip.type, newProps);

				appendAllChildren(instance, wip);

				wip.stateNode = instance;

				// if (finalizeInitialChildren(instance, wip.type, newProps)) {
				// 	markUpdate(wip);
				// }
			}
			bubbleProperties(wip);

			return null;
		case HostText:
			if (current && wip.stateNode) {
				const oldText = current.memoizedProps?.content;
				const nextText = newProps.content;

				if (oldText !== nextText) {
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);

				appendAllChildren(instance, wip);

				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case Fragment:
		case FunctionComponent:
			bubbleProperties(wip);
			return null;
		default:
			break;
	}
};

function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}

			node = node?.return;
		}

		node.sibling.return = node.return;

		node = node.sibling;
	}
}

function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}

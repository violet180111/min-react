import {
	appendInitialChild,
	createInstance,
	createTextInstance,
	finalizeInitialChildren
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { NoFlags, Ref, Update } from './fiberFlags';
import { Container } from './hostConfig';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { popProvider } from './fiberContext';

export const markUpdate = (fiber: FiberNode) => {
	fiber.flags |= Update;
};

export const markRef = (fiber: FiberNode) => {
	fiber.flags |= Ref;
};

export const completeWork = (workInProgress: FiberNode) => {
	if (__DEV__) {
		console.log('completeWork', workInProgress);
	}

	const newProps = workInProgress.pendingProps;
	const current = workInProgress.alternate;

	switch (workInProgress.tag) {
		case HostComponent:
			if (current !== null && workInProgress.stateNode) {
				updateFiberProps(workInProgress.stateNode, newProps);

				if (current.ref !== workInProgress.ref) {
					markRef(workInProgress);
				}
			} else {
				const instance = createInstance(workInProgress.type, newProps);

				appendAllChildren(instance, workInProgress);

				workInProgress.stateNode = instance;

				if (workInProgress.ref !== null) {
					markRef(workInProgress);
				}

				// if (finalizeInitialChildren(instance, workInProgress.type, newProps)) {
				// 	markUpdate(workInProgress);
				// }
			}
			bubbleProperties(workInProgress);

			return null;
		case HostText:
			if (current && workInProgress.stateNode) {
				const oldText = current.memoizedProps?.content;
				const nextText = newProps.content;

				if (oldText !== nextText) {
					markUpdate(workInProgress);
				}
			} else {
				const instance = createTextInstance(newProps.content);

				appendAllChildren(instance, workInProgress);

				workInProgress.stateNode = instance;
			}
			bubbleProperties(workInProgress);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
			bubbleProperties(workInProgress);
			return null;
		case ContextProvider:
			const context = workInProgress.type._context;

			popProvider(context);
			bubbleProperties(workInProgress);
			return null;
		default:
			return null;
	}
};

function appendAllChildren(parent: Container, workInProgress: FiberNode) {
	let node = workInProgress.child;

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === workInProgress) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === workInProgress) {
				return;
			}

			node = node?.return;
		}

		node.sibling.return = node.return;

		node = node.sibling;
	}
}

function bubbleProperties(workInProgress: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = workInProgress.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = workInProgress;
		child = child.sibling;
	}

	workInProgress.subtreeFlags |= subtreeFlags;
}

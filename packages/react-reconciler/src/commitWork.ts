import {
	Container,
	appendChildToContainer,
	commitUpdate,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);

				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}

				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		commitPlacement(finishedWork);

		finishedWork.flags &= ~Placement;
	}

	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);

		finishedWork.flags &= ~Update;
	}
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;

		if (deletions) {
			deletions.forEach((childToDeletion) => {
				commitDeletion(childToDeletion);
			});
		}

		finishedWork.flags &= ~ChildDeletion;
	}
};

const getHostParent = (fiber: FiberNode) => {
	let parent = fiber.return;

	while (parent !== null) {
		if (parent.tag === HostComponent) {
			return parent.stateNode as Container;
		}

		if (parent.tag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}

		parent = parent.return;
	}

	if (__DEV__) {
		console.warn('未找到 host parent');
	}

	return null;
};

const appendPlacementNodeIntoContainer = (
	finishedWork: FiberNode,
	hostParent: Container
) => {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;

		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);

			sibling = sibling.sibling;
		}
	}
};

const commitDeletion = (childToDeletion: FiberNode) => {
	let rootHostNode: FiberNode | null = null;

	commitNestedComponent(childToDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			case HostComponent:
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			case FunctionComponent:
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmountFiber');
				}
				break;
		}
	});

	if (rootHostNode) {
		const hostParent = getHostParent(rootHostNode);

		if (hostParent) {
			removeChild(hostParent, (rootHostNode as FiberNode).stateNode);
		}
	}

	childToDeletion.return = null;
	childToDeletion.child = null;
};

const commitNestedComponent = (
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) => {
	let node = root;

	while (true) {
		onCommitUnmount(node);

		while (node.child) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}

			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.info('执行 Placement 操作', finishedWork);
	}

	const hostParent = getHostParent(finishedWork) as Container;

	appendPlacementNodeIntoContainer(finishedWork, hostParent);
};

import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
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
		console.error('未找到 host parent');
	}

	return null;
};

const getHostSibling = (fiber: FiberNode) => {
	let node = fiber;

	findSibling: while (true) {
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;

		while (node.tag !== HostText && node.tag !== HostComponent) {
			if ((node.flags & Placement) !== NoFlags) {
				continue findSibling;
			}

			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node.return;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
};

const insertOrAppendPlacementNodeIntoContainer = (
	hostParent: Container,
	finishedWork: FiberNode,
	before?: Instance
) => {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(hostParent, finishedWork.stateNode, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}

		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(hostParent, child);
		let sibling = child.sibling;

		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(hostParent, sibling);

			sibling = sibling.sibling;
		}
	}
};

function recordHostChildrenToDelete(
	hostChildrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	const lastOne = hostChildrenToDelete[hostChildrenToDelete.length - 1];
	if (!lastOne) {
		hostChildrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				hostChildrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
}

const commitDeletion = (childToDeletion: FiberNode) => {
	// 在Fragment之前，只需删除子树的根Host节点，但支持Fragment后，可能需要删除同级多个节点
	const hostChildrenToDelete: FiberNode[] = [];

	commitNestedComponent(childToDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostText:
			case HostComponent:
				recordHostChildrenToDelete(hostChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				return;
			default:
				if (__DEV__) {
					console.error('未处理的unmountFiber');
				}
				break;
		}
	});

	if (hostChildrenToDelete.length) {
		const hostParent = getHostParent(childToDeletion);

		if (hostParent) {
			hostChildrenToDelete.forEach((node) => {
				removeChild(hostParent, node.stateNode);
			});
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

	const sibling = getHostSibling(finishedWork);

	insertOrAppendPlacementNodeIntoContainer(hostParent, finishedWork, sibling);
};

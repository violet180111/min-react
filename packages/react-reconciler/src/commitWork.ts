import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	PassiveMask,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		if (
			(nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect, root);

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

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
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
				commitDeletion(childToDeletion, root);
			});
		}

		finishedWork.flags &= ~ChildDeletion;
	}

	if ((flags & PassiveEffect) !== NoFlags) {
		commitPassiveEffect(finishedWork, root, 'update');

		finishedWork.flags &= ~PassiveEffect;
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
				node.child.return = node;
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

const commitHookEffectList = (
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) => {
	let effect = lastEffect.next as Effect;

	do {
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}

		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
};

export const commitHookEffectListUnmount = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;

		if (typeof destroy === 'function') {
			destroy();
		}

		effect.tag &= ~HookHasEffect;
	});
};

export const commitHookEffectListDestroy = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;

		if (typeof destroy === 'function') {
			destroy();
		}
	});
};

export const commitHookEffectListCreate = (
	flags: Flags,
	lastEffect: Effect
) => {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;

		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
};

const commitPassiveEffect = (
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) => {
	if (__DEV__) {
		console.info('执行 PassiveEffect 操作', root);
	}

	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	) {
		return;
	}

	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在 effect');
		}

		root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
	}
};

const commitDeletion = (childToDeletion: FiberNode, root: FiberRootNode) => {
	if (__DEV__) {
		console.info('执行 Deletion 操作', childToDeletion);
	}
	// 在Fragment之前，只需删除子树的根Host节点，但支持Fragment后，可能需要删除同级多个节点
	const hostChildrenToDelete: FiberNode[] = [];

	commitNestedComponent(childToDeletion, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostText:
			case HostComponent:
				recordHostChildrenToDelete(hostChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				commitPassiveEffect(childToDeletion, root, 'unmount');
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

		if (node.child) {
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

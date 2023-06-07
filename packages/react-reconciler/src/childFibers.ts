import { Key, Props, ReactElement } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { Fragment, HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function childReconciler(shouldTrackSideEffects: boolean) {
	function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
		const clone = createWorkInProgress(fiber, pendingProps);

		clone.index = 0;
		clone.sibling = null;

		return clone;
	}

	function createChild(returnFiber: FiberNode, newChild: any) {
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			const created = new FiberNode(HostText, { content: newChild + '' }, null);

			created.return = returnFiber;

			return created;
		}

		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE: {
					const created = createFiberFromElement(newChild);

					created.return = returnFiber;

					return created;
				}
			}

			if (Array.isArray(newChild)) {
				const created = createFiberFromFragment(newChild, null);

				created.return = returnFiber;

				return created;
			}
		}

		return null;
	}

	function placeChild(
		newFiber: FiberNode,
		lastPlacedIndex: number,
		newIndex: number
	): number {
		newFiber.index = newIndex;

		if (!shouldTrackSideEffects) {
			return lastPlacedIndex;
		}

		const current = newFiber.alternate;

		if (current) {
			const oldIndex = current.index;

			if (oldIndex < lastPlacedIndex) {
				newFiber.flags |= Placement;
			} else {
				lastPlacedIndex = oldIndex;
			}
		} else {
			newFiber.flags |= Placement;
		}

		return lastPlacedIndex;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackSideEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}

		return fiber;
	}

	function deleteChild(returnFiber: FiberNode, childToDeletion: FiberNode) {
		if (!shouldTrackSideEffects) return;

		const deletions = returnFiber.deletions;

		if (deletions) {
			deletions.push(childToDeletion);
		} else {
			returnFiber.deletions = [childToDeletion];
		}

		returnFiber.flags |= ChildDeletion;
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstFiber: FiberNode | null
	) {
		if (!shouldTrackSideEffects) {
			return;
		}

		let childToDeletion = currentFirstFiber;

		while (childToDeletion) {
			deleteChild(returnFiber, childToDeletion);

			childToDeletion = childToDeletion.sibling;
		}
	}

	function mapRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	): ExistingChildren {
		const existingChildren = new Map();

		let current = currentFirstChild;

		while (current) {
			const key = current.key === null ? current.index : current.key;

			existingChildren.set(key, current);

			current = current.sibling;
		}

		return existingChildren;
	}

	function updateFragment(
		returnFiber: FiberNode,
		current: FiberNode | null,
		elements: any[],
		key: Key
	): FiberNode {
		if (current === null || current.tag !== Fragment) {
			const created = createFiberFromFragment(elements, key);

			created.return = returnFiber;

			return created;
		} else {
			const existing = useFiber(current, elements);

			existing.return = returnFiber;

			return existing;
		}
	}

	function updateSlot(
		returnFiber: FiberNode,
		oldFiber: FiberNode | null,
		newChild: any
	) {
		const key = oldFiber !== null ? oldFiber.key : null;

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			if (oldFiber) {
				if (key !== null) {
					return null;
				}
				const existing = useFiber(oldFiber, { content: newChild + '' });

				existing.return = returnFiber;

				return existing;
			}

			const created = new FiberNode(HostText, { content: newChild + '' }, null);

			created.return = returnFiber;

			return created;
		}

		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (newChild.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(returnFiber, oldFiber, newChild, key);
					}
					if (newChild.key === key) {
						if (oldFiber) {
							if (oldFiber.type === newChild.type) {
								const existing = useFiber(oldFiber, newChild.props);

								existing.return = returnFiber;

								return existing;
							}
						}

						const created = createFiberFromElement(newChild);

						created.return = returnFiber;

						return created;
					} else {
						return null;
					}
			}

			if (Array.isArray(newChild)) {
				return updateFragment(returnFiber, oldFiber, newChild, key);
			}
		}

		return null;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		newChild: any
	): FiberNode | null {
		const key = newChild.key !== null ? newChild.key : index;
		const matchedFiber = existingChildren.get(key) ?? null;

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			if (matchedFiber) {
				if (matchedFiber.tag === HostText) {
					existingChildren.delete(key);

					const existing = useFiber(matchedFiber, { content: newChild + '' });

					existing.return = returnFiber;

					return existing;
				}
			}

			const created = new FiberNode(HostText, { content: newChild + '' }, null);

			created.return = returnFiber;

			return created;
		}

		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (newChild.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(returnFiber, matchedFiber, newChild, key);
					}
					if (matchedFiber) {
						if (matchedFiber.type === newChild.type) {
							existingChildren.delete(key);

							const existing = useFiber(matchedFiber, newChild.props);

							existing.return = returnFiber;

							return existing;
						}
					}

					const created = createFiberFromElement(newChild);

					created.return = returnFiber;

					return created;
			}

			if (Array.isArray(newChild)) {
				if (__DEV__) {
					console.error('未实现的数组类型的child');
					return null;
				}
			}
		}

		if (Array.isArray(newChild)) {
			return updateFragment(returnFiber, matchedFiber, newChild, key);
		}

		return null;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		let current = currentFiber;
		while (current) {
			if (current.tag === HostText) {
				const existing = useFiber(current, { content });

				existing.return = returnFiber;

				deleteRemainingChildren(returnFiber, current.sibling);

				return existing;
			}

			deleteRemainingChildren(returnFiber, current);

			current = current.sibling;
		}

		const fiber = new FiberNode(HostText, { content }, null);

		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: any
	) {
		const key = element.key;

		while (currentFiber) {
			if (currentFiber.key === key) {
				const elementType = element.type;
				if (elementType === REACT_FRAGMENT_TYPE) {
					if (currentFiber.tag === Fragment) {
						deleteRemainingChildren(returnFiber, currentFiber.sibling);

						const existing = useFiber(currentFiber, element.props.children);

						existing.return = returnFiber;

						return existing;
					}
				} else {
					if (elementType === currentFiber.type) {
						deleteRemainingChildren(returnFiber, currentFiber.sibling);

						const existing = useFiber(currentFiber, element.props);

						existing.return = returnFiber;

						return existing;
					}

					deleteRemainingChildren(returnFiber, currentFiber);

					break;
				}
			} else {
				deleteChild(returnFiber, currentFiber);

				currentFiber = currentFiber.sibling;
			}
		}

		let fiber: FiberNode;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}

		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstFiber: FiberNode | null,
		newChild: any
	) {
		let previousNewFiber: FiberNode | null = null;
		let resultingFirstChild: FiberNode | null = null;

		let oldFiber = currentFirstFiber;
		let nextOldFiber = null;

		let lastPlacedIndex = 0;
		let newIdx = 0;

		for (; oldFiber !== null && newIdx < newChild.length; newIdx++) {
			nextOldFiber = oldFiber.sibling;

			const newFiber = updateSlot(returnFiber, oldFiber, newChild[newIdx]);

			if (newFiber === null) {
				if (oldFiber === null) {
					oldFiber = nextOldFiber;
				}

				break;
			}

			if (shouldTrackSideEffects) {
				if (oldFiber && newFiber.alternate === null) {
					deleteChild(returnFiber, oldFiber);
				}
			}

			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

			if (previousNewFiber === null) {
				resultingFirstChild = newFiber;
			} else {
				previousNewFiber.sibling = newFiber;
			}

			previousNewFiber = newFiber;
			oldFiber = nextOldFiber;
		}

		if (newIdx === newChild.length) {
			deleteRemainingChildren(returnFiber, oldFiber);

			return resultingFirstChild;
		}

		if (oldFiber === null) {
			for (; newIdx < newChild.length; newIdx++) {
				const newFiber = createChild(returnFiber, newChild[newIdx]);

				if (newFiber === null) {
					continue;
				}

				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
				if (previousNewFiber === null) {
					resultingFirstChild = newFiber;
				} else {
					previousNewFiber.sibling = newFiber;
				}
				previousNewFiber = newFiber;
			}

			return resultingFirstChild;
		}

		const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

		for (; newIdx < newChild.length; newIdx++) {
			const after = newChild[newIdx];
			const newFiber = updateFromMap(
				returnFiber,
				existingChildren,
				newIdx,
				after
			);

			if (newFiber === null) {
				continue;
			}

			if (shouldTrackSideEffects && newFiber.alternate !== null) {
				existingChildren.delete(newFiber.key === null ? newIdx : newFiber.key);
			}

			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

			if (previousNewFiber === null) {
				resultingFirstChild = newFiber;
			} else {
				previousNewFiber.sibling = newFiber;
			}
			previousNewFiber = newFiber;
		}

		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return resultingFirstChild;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: any
	) {
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;

		if (isUnkeyedTopLevelFragment) {
			newChild = newChild.props.children;
		}

		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
			}

			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}
		}

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		if (currentFiber) {
			deleteRemainingChildren(returnFiber, currentFiber);
		}

		return null;
	};
}

export const updateReconcileChildFibers = childReconciler(true);
export const mountReconcileChildFibers = childReconciler(false);

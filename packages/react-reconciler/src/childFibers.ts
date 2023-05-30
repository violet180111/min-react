import { Props, ReactElement } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFormElement,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTag';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

function childReconciler(shouldTrackSideEffects: boolean) {
	function createChild(returnFiber: FiberNode, newChild: any) {
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			const created = new FiberNode(HostText, { content: newChild + '' }, null);

			created.return = returnFiber;

			return created;
		}

		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE: {
					const created = createFiberFormElement(newChild);

					created.return = returnFiber;

					return created;
				}
			}

			if (Array.isArray(newChild)) {
				if (__DEV__) {
					console.warn('未实现的数组类型的child');
					return null;
				}
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
					if (newChild.key === key) {
						if (oldFiber) {
							if (oldFiber.type === newChild.type) {
								const existing = useFiber(oldFiber, newChild.props);

								existing.return = returnFiber;

								return existing;
							}
						}

						const created = createFiberFormElement(newChild);

						created.return = returnFiber;

						return created;
					} else {
						return null;
					}
			}

			if (Array.isArray(newChild)) {
				if (__DEV__) {
					console.warn('未实现的数组类型的child');
					return null;
				}
			}
		}

		return null;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		newChild: ReactElement
	): FiberNode | null {
		const key = newChild.key !== null ? newChild.key : index;
		const before = existingChildren.get(key);

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			if (before) {
				if (before.tag === HostText) {
					existingChildren.delete(key);

					const existing = useFiber(before, { content: newChild + '' });

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
					if (before) {
						if (before.type === newChild.type) {
							existingChildren.delete(key);

							const existing = useFiber(before, newChild.props);

							existing.return = returnFiber;

							return existing;
						}
					}

					const created = createFiberFormElement(newChild);

					created.return = returnFiber;

					return created;
			}

			if (Array.isArray(newChild)) {
				if (__DEV__) {
					console.warn('未实现的数组类型的child');
					return null;
				}
			}
		}

		return null;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber) {
			if (currentFiber.tag === HostText) {
				const existing = useFiber(currentFiber, { content });

				existing.return = returnFiber;

				deleteRemainingChildren(returnFiber, currentFiber.sibling);

				return existing;
			}

			deleteRemainingChildren(returnFiber, currentFiber);
		}

		const fiber = new FiberNode(HostText, { content }, null);

		fiber.return = returnFiber;

		return fiber;
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElement
	) {
		const key = element.key;

		while (currentFiber) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (element.type === currentFiber.type) {
						const existing = useFiber(currentFiber, element.props);

						existing.return = returnFiber;

						deleteRemainingChildren(returnFiber, currentFiber.sibling);

						return existing;
					}

					deleteRemainingChildren(returnFiber, currentFiber);

					break;
				} else {
					if (__DEV__) {
						console.warn('未实现的ReactElement类型');

						break;
					}
				}
			} else {
				deleteChild(returnFiber, currentFiber);

				currentFiber = currentFiber.sibling;
			}
		}

		const fiber = createFiberFormElement(element);

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
				continue;
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

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: any
	) {
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
		if (__DEV__) {
			if (currentFiber) {
				deleteChild(returnFiber, currentFiber);
			}

			console.warn('未实现的reconcile类型', newChild);
		}
		return null;
	};
}

export function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);

	clone.index = 0;
	clone.sibling = null;

	return clone;
}

export const updateReconcileChildFibers = childReconciler(true);
export const mountReconcileChildFibers = childReconciler(false);

import { Props, ReactElement } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFormElement,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTag';
import { ChildDeletion, Placement } from './fiberFlags';

function childReconciler(shouldTrackEffect: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDeletion: FiberNode) {
		if (!shouldTrackEffect) return;

		const deletions = returnFiber.deletions;

		if (deletions) {
			deletions.push(childToDeletion);
		} else {
			returnFiber.deletions = [childToDeletion];
		}

		returnFiber.flags |= ChildDeletion;
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElement
	) {
		const key = element.key;

		work: if (currentFiber) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (element.type === currentFiber.type) {
						const existing = useFiber(currentFiber, element.props);

						existing.return = returnFiber;
						return existing;
					}

					deleteChild(returnFiber, currentFiber);

					break work;
				} else {
					if (__DEV__) {
						console.warn('未实现的ReactElement类型');

						break work;
					}
				}
			} else {
				deleteChild(returnFiber, currentFiber);
			}
		}

		const fiber = createFiberFormElement(element);

		fiber.return = returnFiber;

		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffect && fiber.alternate === null) {
			fiber.flags |= Placement;
		}

		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		if (currentFiber) {
			if (currentFiber.tag === HostText) {
				const existing = useFiber(currentFiber, { content });

				existing.return = returnFiber;
				return existing;
			}

			deleteChild(returnFiber, currentFiber);
		}

		const fiber = new FiberNode(HostText, { content }, null);

		fiber.return = returnFiber;

		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElement
	) {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);

				default:
					if (__DEV__) {
						if (currentFiber) {
							deleteChild(returnFiber, currentFiber);
						}

						console.warn('未实现的reconcile类型', newChild);
					}
					break;
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

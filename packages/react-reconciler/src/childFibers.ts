import { ReactElement } from 'shared/ReactTypes';
import { FiberNode, createFiberFormElement } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTag';
import { NoFlags, Placement } from './fiberFlags';

function childReconciler(shouldTrackEffect: boolean) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElement
	) {
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
		return null;
	};
}

export const updateReconcileChildFibers = childReconciler(true);
export const mountReconcileChildFibers = childReconciler(false);

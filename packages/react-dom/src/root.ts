import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';
import { allNativeEvents, initEvent } from './SyntheticEvent';
import type { Container } from './hostConfig';
import type { EventType } from './SyntheticEvent';
import type { ReactElement } from 'shared/ReactTypes';

export function createRoot(container: Container) {
	const root = createContainer(container);

	allNativeEvents.forEach((event) => {
		initEvent(container, event as EventType);
	});

	return {
		render(element: ReactElement) {
			return updateContainer(element, root);
		}
	};
}

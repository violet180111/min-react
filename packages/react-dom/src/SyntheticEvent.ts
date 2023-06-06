import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_runWithPriority as runWithPriority
} from 'scheduler';
import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export type EventCallback = (e: Event) => void;
export type Paths = {
	capture: EventCallback[];
	bubble: EventCallback[];
};
export type EventType = keyof typeof topLevelEventsToReactNames;
export interface SyntheticEvent extends Event {
	isStopPropagation: boolean;
}

export const topLevelEventsToReactNames = {
	click: ['onClickCapture', 'onClick']
};

export const allNativeEvents = Object.keys(topLevelEventsToReactNames);

export const elementPropsKey = '__props';
export const validEventTypeList = ['click'];

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: EventType) {
	if (!validEventTypeList.includes(eventType)) {
		console.error('当前不支持', eventType, '事件');
		return;
	}

	if (__DEV__) {
		console.log('初始化事件', eventType);
	}

	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}

export function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;

	syntheticEvent.isStopPropagation = false;

	const originStopPropagation = syntheticEvent.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		originStopPropagation();
	};

	return syntheticEvent;
}

export function dispatchEvent(
	container: Container,
	eventType: EventType,
	e: Event
) {
	const targetElement = e.target;

	if (targetElement === null) {
		console.error('事件不存在target', e);
		return;
	}

	const paths = collectPaths(targetElement as DOMElement, container, eventType);

	const se = createSyntheticEvent(e);

	triggerEventFlow(paths.capture, se);

	triggerEventFlow(paths.bubble, se);
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];

		runWithPriority(eventTypeToSchedulePriority(se.type), () => {
			callback.call(null, se);
		});

		if (se.isStopPropagation) {
			break;
		}
	}
}

function getEventCallbackNameFromEventType(
	eventType: EventType
): string[] | undefined {
	return topLevelEventsToReactNames[eventType];
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: EventType
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};

	while (targetElement && targetElement !== container) {
		const elementProps = targetElement['__props'];

		if (elementProps) {
			const callbackNames = getEventCallbackNameFromEventType(eventType);

			if (callbackNames) {
				const [captureEventName, bubbleEventName] = callbackNames;

				if (elementProps[captureEventName]) {
					paths.capture.unshift(elementProps[captureEventName]);
				}

				if (elementProps[bubbleEventName]) {
					paths.bubble.push(elementProps[bubbleEventName]);
				}
			}
		}

		targetElement = targetElement.parentNode as DOMElement;
	}

	return paths;
}

export function eventTypeToSchedulePriority(eventType: string) {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			return ImmediatePriority;
		case 'scroll':
			return UserBlockingPriority;
		default:
			return NormalPriority;
	}
}

import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTag';
import { DOMElement, updateFiberProps } from './SyntheticEvent';
import { Props } from 'shared/ReactTypes';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props) => {
	const element = document.createElement(type);

	// updateFiberProps(element as DOMElement, props);
	return element;
};

export const createTextInstance = (content: string) => {
	const textNode = document.createTextNode(content);

	return textNode;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const setProp = (
	domElement: Element,
	tag: string,
	key: string,
	value: any,
	props: any,
	preValue: any
) => {};

export const setInitialProperties = (
	domElement: Instance,
	type: string,
	props: Props
) => {
	for (const propKey in props) {
		if (!props.hasOwnProperty(propKey)) {
			continue;
		}
		const propValue = props[propKey];
		if (propValue == null) {
			continue;
		}
		setProp(domElement, type, propKey, propValue, props, null);
	}
};

export const finalizeInitialChildren = (
	domElement: Instance,
	type: string,
	props: Props
) => {
	setInitialProperties(domElement, type, props);

	return false;
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const content = fiber.memoizedProps?.content;
			return commitTextUpdate(fiber.stateNode, content);
		default:
			break;
	}
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.textContent = content;
}

export function removeChild(
	container: Container,
	child: Instance | TextInstance
) {
	container.removeChild(child);
}

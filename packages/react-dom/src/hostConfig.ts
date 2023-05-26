export type Container = any;
export type Instance = any;

export const createInstance = (type: string, props: any) => {
	const element = document.createElement(type);

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

export const appendChildToContainer = appendInitialChild;

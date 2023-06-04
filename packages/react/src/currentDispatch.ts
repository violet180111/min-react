import { Action } from 'shared/ReactTypes';

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: (callback: () => void | null, deps: any[] | null) => void;
}

export type Dispatch<State> = (action: Action<State>) => void;

export const currentDispatcher: {
	current: Dispatcher | null;
} = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook 只能在函数组件中使用');
	}

	return dispatcher;
};

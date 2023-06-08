export type Ref = { current: any } | ((instance: any) => void) | null;
export type ElementType = any;
export type Key = string | null;
export type Props = {
	[key: string]: any;
	children?: any;
};

export interface ReactElement {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
	__mark: 'violet180111';
}

export type Action<State> = State | ((prevState: State) => State);

export type ReactProvider<T> = {
	$$typeof: symbol | number;
	_context: ReactContext<T>;
};

export type ReactContext<T> = {
	$$typeof: symbol | number;
	Provider: ReactProvider<T> | null;
	_currentValue: T;
};

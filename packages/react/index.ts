import { jsx, isValidElement as isValidElementFn } from './src/jsx';
import { resolveDispatcher, currentDispatcher } from './src/currentDispatch';
import currentBatchConfig from './src/currentBatchConfig';
import type { Dispatcher } from './src/currentDispatch';

export { createContext } from './src/context';

export const useState: Dispatcher['useState'] = (initialState) => {
	console.log('useState 被调用了');
	const dispatcher = resolveDispatcher();

	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	console.log('useEffect 被调用了');

	const dispatcher = resolveDispatcher();

	return dispatcher.useEffect(create, deps);
};

export const useRef: Dispatcher['useRef'] = (initialValue) => {
	console.log('useRef 被调用了');
	const dispatcher = resolveDispatcher();

	return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher['useContext'] = (context) => {
	console.log('useContext 被调用了');
	const dispatcher = resolveDispatcher();

	return dispatcher.useContext(context);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	console.log('useTransition 被调用了');
	const dispatcher = resolveDispatcher();

	return dispatcher.useTransition();
};

export const SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';
export const createElement = jsx;
export const isValidElement = isValidElementFn;

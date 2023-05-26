import { jsx } from './src/jsx';
import { resolveDispatcher, currentDispatcher } from './src/currentDispatch';
import type { Dispatcher } from './src/currentDispatch';

export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();

	return dispatcher.useState(initialState);
};

export const SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export default {
	version: '0.0.0',
	createElement: jsx
};

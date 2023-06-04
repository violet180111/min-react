type Noop = (...args: any[]) => void;

let syncQueue: Noop[] | null = null;
let isFlushingSyncQueue = false;

export function scheduleSyncCallback(callback: Noop) {
	if (syncQueue === null) {
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

export function flushSyncCallbacks() {
	if (!isFlushingSyncQueue && syncQueue) {
		isFlushingSyncQueue = true;

		try {
			syncQueue.forEach((callback) => callback());
			syncQueue = null;
		} catch (e) {
			if (__DEV__) {
				console.error('flushSyncCallbacks 出错', e);
			}
		} finally {
			isFlushingSyncQueue = false;
		}
	}
}

import {
	unstable_IdlePriority as IdlePriority,
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_LowPriority as LowPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode
} from 'scheduler';

type Priority =
	| typeof IdlePriority
	| typeof ImmediatePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority;

type Work = {
	count: number;
	priority: Priority;
};

const priorityList = {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority
};

Object.keys(priorityList).forEach((key) => {
	const button = document.createElement('button');

	button.textContent = key;

	button.onclick = () => {
		workList.push({
			count: 300,
			priority: priorityList[key as keyof typeof priorityList] as Priority
		});

		schedule();
	};

	document.body.appendChild(button);
});

const p = document.createElement('p');

p.style.wordBreak = 'break-all';

document.body.appendChild(p);

const workList: Work[] = [];

let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

function schedule() {
	const cbNode = getFirstCallbackNode();
	const work = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

	if (!work) {
		curCallback = null;

		cbNode && cancelCallback(cbNode);

		return;
	}

	const curPriority = work.priority;

	if (curPriority === prevPriority) {
		return;
	}

	cbNode && cancelCallback(cbNode);

	if (work) {
		curCallback = scheduleCallback(curPriority, perform.bind(null, work));
	}
}

function perform(work: Work, didTimeout?: boolean): any {
	const needSync = work.priority === ImmediatePriority || didTimeout;

	while ((needSync || !shouldYield()) && work.count) {
		work.count--;

		insertSpan(work.priority);
	}

	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);

		workList.splice(workIndex, 1);

		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;

	schedule();

	const newCallback = curCallback;

	if (newCallback && prevCallback === newCallback) {
		return perform.bind(null, work);
	}
}

function insertSpan(priority: Priority) {
	const span = document.createElement('span');

	doSomeBusyWork(10000000);

	span.textContent = priority + '';

	p.appendChild(span);
}

function doSomeBusyWork(count: number) {
	while (count) {
		count--;
	}
}

import React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	// const [list, setList] = useState(['a', 'b', 'c']);
	// @ts-ignore
	// return <div>{num === 3 ? <div>{num}</div> : <span>{num}</span>}</div>;
	// const handleClick = () => {
	// 	setList(['c', 'b', 'a']);
	// };

	// return <div onClickCapture={handleClick}>{num}</div>;
	// window.setList = setList;

	const [num, setNum] = useState(1);
	const arr =
		num === 1
			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

	return (
		<ul onClick={() => setNum(0)}>
			{arr}
			<li key="4">4</li>
			<li key="5">5</li>
		</ul>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	(<App />) as any
);

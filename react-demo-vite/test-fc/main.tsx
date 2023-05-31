import React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [list, setList] = useState(['a', 'b', 'c']);
	// @ts-ignore
	// window.setNum = setNum;
	// return <div>{num === 3 ? <div>{num}</div> : <span>{num}</span>}</div>;
	const handleClick = () => {
		setList(['c', 'b', 'a']);
	};

	// return <div onClickCapture={handleClick}>{num}</div>;
	// window.setList = setList;
	return (
		<ul onClick={handleClick}>
			{list.map((item) => {
				return <li key={item}>{item}</li>;
			})}
		</ul>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	(<App />) as any
);

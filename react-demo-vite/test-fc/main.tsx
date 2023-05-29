import React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(1);
	// @ts-ignore
	window.setNum = setNum;
	return <div>{num === 3 ? <div>{num}</div> : <span>{num}</span>}</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	(<App />) as any
);

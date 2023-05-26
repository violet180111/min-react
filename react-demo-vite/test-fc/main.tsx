import React from 'react';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num] = useState(1);
	return (
		<div>
			<span>{num}</span>
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	(<App />) as any
);

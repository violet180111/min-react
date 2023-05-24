import fs from 'fs';
import path from 'path';

import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgPath = path.resolve(__dirname, '../../packages');
const distPath = path.resolve(__dirname, '../../dist/node_modules');

export function resolvePkgPath(pkgName, isDist) {
	return path.join(isDist ? distPath : pkgPath, pkgName);
}

export function getPkgJSON(pkgName) {
	const pkgJsonPath = path.join(resolvePkgPath(pkgName), 'package.json');
	const str = fs.readFileSync(pkgJsonPath, { encoding: 'utf-8' });

	return JSON.parse(str);
}

export function getBaseRollupPlugins(
	alias = {
		__DEV__: true
	},
	{ typescript = {} } = {}
) {
	return [replace(alias), cjs(), ts(typescript)];
}

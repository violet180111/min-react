import generatePkgJson from 'rollup-plugin-generate-package-json';
import { getBaseRollupPlugins, getPkgJSON, resolvePkgPath } from './utils.js';

const { name, module } = getPkgJSON('react');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

/** @type {import("rollup").RollupOptions} */
export default [
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			name: 'react',
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePkgJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			{
				file: `${pkgDistPath}/jsx-runtime.js`,
				name: 'jsx-runtime',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				format: 'umd'
			}
		],
		plugins: getBaseRollupPlugins()
	}
];

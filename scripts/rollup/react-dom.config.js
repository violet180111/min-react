import generatePkgJson from 'rollup-plugin-generate-package-json';
import alias from '@rollup/plugin-alias';
import { getBaseRollupPlugins, getPkgJSON, resolvePkgPath } from './utils.js';

const { name, module, peerDependencies } = getPkgJSON('react-dom');
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

/** @type {import("rollup").RollupOptions} */
export default [
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'reactDOM',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`,
				name: 'reactDOMClient',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies)],
		plugins: [
			...getBaseRollupPlugins(),
			alias({
				entries: {
					hostConfig: `${pkgPath}/src/hostConfig.ts`
				}
			}),
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
		input: `${pkgPath}/test-utils.ts`,
		output: [
			{
				file: `${pkgDistPath}/test-utils.js`,
				name: 'testUtils',
				format: 'umd'
			}
		],
		external: ['react-dom', 'react'],
		plugins: getBaseRollupPlugins()
	}
];

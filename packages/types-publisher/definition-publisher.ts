import { TypingsData, DefinitionFileKind } from './definition-parser';

export interface PublishSettings {
	scopeName: string;
	outputPath: string;
}

export function publish() {
	const args: string[] = [
		'publish',
		// packagePath,
		'--access public'
	];
}

function createPackageJSON(typing: TypingsData, settings: PublishSettings, fileVersion: number) {
	const dependencies: any = {};
	typing.moduleDependencies.forEach(d => dependencies[d] = '*');
	typing.libraryDependencies.forEach(d => dependencies[`@${settings.scopeName}/${d}`] = '*');

	return ({
		name: `@${settings.scopeName}/${typing.packageName}`,
		version: `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${fileVersion}`,
		description: `Type definitions for ${typing.libraryName} from ${typing.sourceRepoURL}`,
		main: 'index.js',
		scripts: {},
		author: typing.authors,
		license: 'MIT',
		typings: typing.definitionFilename,
		dependencies: dependencies
	});
}

function createReadme(typing: TypingsData) {
	const lines: string[] = [];

	lines.push(`This package contains type definitions for ${typing.libraryName}.`)
	if (typing.projectName) {
		lines.push('');
		lines.push(`The project URL is ${typing.projectName}`);
	}

	if (typing.hasNpmPackage) {
		lines.push('');
		lines.push(`The corresponding NPM package is https://www.npmjs.com/package/${typing.packageName}`);
	}

	if (typing.authors) {
		lines.push('');
		lines.push(`These definitions were written by ${typing.authors}.`);
	}

	lines.push('');
	lines.push(`Typings were exported from ${typing.sourceRepoURL} in the ${typing.folder} directory.`);

	lines.push('');
	lines.push(`Additional Details`)
	lines.push(` * Last updated: ${(new Date()).toUTCString()}`);
	lines.push(` * Typings kind: ${DefinitionFileKind[typing.type]}`);
	lines.push(` * Library Dependencies: ${typing.libraryDependencies.length ? typing.libraryDependencies.join(', ') : 'none'}`);
	lines.push(` * Module Dependencies: ${typing.moduleDependencies.length ? typing.moduleDependencies.join(', ') : 'none'}`);
	lines.push(` * Globals: ${typing.globals.length ? typing.globals.join(', ') : 'none'}`);

	return lines.join('\r\n');
}


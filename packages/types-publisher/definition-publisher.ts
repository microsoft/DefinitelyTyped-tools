import { TypingsData, DefinitionFileKind } from './definition-parser';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

export interface PublishSettings {
	// e.g. 'typings', not '@typings'
	scopeName: string;
	// e.g. ./output/
	outputPath: string;
}

namespace Versions {
	const versionFilename = 'versions.json';

	interface VersionMap {
		[typingsPackageName: string]: {
			lastVersion: number;
			lastContentHash: string;
		};
	}

	export function performUpdate(key: string, content: string, update: (version: number) => void) {
		let data: VersionMap = fs.existsSync(versionFilename) ? JSON.parse(fs.readFileSync(versionFilename, 'utf-8')) : {};

		const hashValue = computeHash(key);
		let entry = data[key];

		if (entry === undefined) {
			data[key] = entry = { lastVersion: 0, lastContentHash: '' };
		}

		if (entry.lastContentHash !== hashValue) {
			const vNext = entry.lastVersion + 1;
			update(vNext);

			data[key] = { lastVersion: vNext, lastContentHash: hashValue };
			fs.writeFileSync(versionFilename, JSON.stringify(data, undefined, 4));

			return true;
		}

		return false;
	}

	export function computeHash(content: string) {
		const h = crypto.createHash('sha256');
		h.update(content, 'utf-8');
		return h.digest('base64');
	}
}

export function publish(typing: TypingsData, settings: PublishSettings): boolean {
	const args: string[] = [
		'publish',
		// packagePath,
		'--access public'
	];

	const content = fs.readFileSync(typing.definitionFilename, 'utf-8');

	return Versions.performUpdate(typing.folder, content, version => {
		const packageJson = createPackageJSON(typing, settings, version);
		const readme = createReadme(typing);

		const outputPath = path.join(settings.outputPath, typing.folder);
		if (!fs.exists(outputPath)) {
			fs.mkdirSync(outputPath);
		}

		fs.writeFileSync(path.join(outputPath, 'package.json'), packageJson, 'utf-8');
		fs.writeFileSync(path.join(outputPath, 'README.md'), readme, 'utf-8');
		fs.writeFileSync(path.join(outputPath, path.basename(typing.definitionFilename)), fs.readFileSync(typing.definitionFilename));
	});
}


function createPackageJSON(typing: TypingsData, settings: PublishSettings, fileVersion: number) {
	const dependencies: any = {};
	typing.moduleDependencies.forEach(d => dependencies[d] = '*');
	typing.libraryDependencies.forEach(d => dependencies[`@${settings.scopeName}/${d}`] = '*');

	return ({
		name: `@${settings.scopeName}/${typing.packageName}`,
		version: `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${fileVersion}`,
		description: `Type definitions for ${typing.libraryName} from ${typing.sourceRepoURL}`,
		main: '', //? index.js',
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


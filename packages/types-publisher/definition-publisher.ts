import { TypingsData, DefinitionFileKind } from './definition-parser';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as child_process from 'child_process';

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

	export function performUpdate(key: string, content: string, update: (version: number) => boolean) {
		let data: VersionMap = fs.existsSync(versionFilename) ? JSON.parse(fs.readFileSync(versionFilename, 'utf-8')) : {};

		const hashValue = computeHash(key);
		let entry = data[key];

		if (entry === undefined) {
			data[key] = entry = { lastVersion: 0, lastContentHash: '' };
		}

		if (entry.lastContentHash !== hashValue || process.argv.some(arg => arg === '--forceUpdate')) {
			const vNext = entry.lastVersion + 1;
			
			if(update(vNext)) {
				data[key] = { lastVersion: vNext, lastContentHash: hashValue };
				fs.writeFileSync(versionFilename, JSON.stringify(data, undefined, 4));
			}

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

function mkdir(p: string) {
	try {
		fs.statSync(p);
	} catch(e) {
		fs.mkdirSync(p);
	}
}

function patchDefinitionFile(input: string): string {
	const pathToLibrary = /\/\/\/ <reference path="..\/(\w.+)\/.+ \/>/gm;
	let output = input.replace(pathToLibrary, '/// <reference library="$1" />');
	return output;
}

export function publish(typing: TypingsData, settings: PublishSettings): { log: string[] } {
	const log: string[] = [];

	log.push(`Possibly publishing ${typing.libraryName}`);

	let allContent = '';
	// Make the file ordering deterministic so the hash doesn't jump around for no reason
	typing.files.sort();
	for(const file of typing.files) {
		allContent = allContent + fs.readFileSync(path.join(typing.root, file), 'utf-8');
	}

	const actualPackageName = typing.packageName.toLowerCase();

	const didUpdate = Versions.performUpdate(actualPackageName, allContent, version => {
		log.push('Generate package.json and README.md; ensure output path exists');
		const packageJson = JSON.stringify(createPackageJSON(typing, settings, version), undefined, 4);
		const readme = createReadme(typing);

		const outputPath = path.join(settings.outputPath, actualPackageName);
		mkdir(outputPath);

		fs.writeFileSync(path.join(outputPath, 'package.json'), packageJson, 'utf-8');
		fs.writeFileSync(path.join(outputPath, 'README.md'), readme, 'utf-8');

		typing.files.forEach(file => {
			log.push(`Copy and patch ${file}`);
			let content = fs.readFileSync(path.join(typing.root, file), 'utf-8');
			content = patchDefinitionFile(file);
			fs.writeFileSync(path.join(outputPath, file), file);
		});

		const args: string[] = ['npm', 'publish', path.resolve(outputPath), '--access public'];
		const cmd = args.join(' ');
		log.push(`Run ${cmd}`);
		try {
			const result = <string>child_process.execSync(cmd, { encoding: 'utf-8' });
			log.push(`Ran successfully`);
			log.push(result);
			return true;
		} catch(e) {
			log.push(`!!! Publish failed`);
			log.push(JSON.stringify(e));
			return false;
		}
	});

	if (!didUpdate) {
		log.push('Package was already up-to-date');
	}

	return { log };
}


function createPackageJSON(typing: TypingsData, settings: PublishSettings, fileVersion: number) {
	const dependencies: any = {};
	typing.moduleDependencies.forEach(d => dependencies[d] = '*');
	typing.libraryDependencies.forEach(d => dependencies[`@${settings.scopeName}/${d}`] = '*');

	return ({
		name: `@${settings.scopeName}/${typing.packageName.toLowerCase()}`,
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
		lines.push(`The project URL or description is ${typing.projectName}`);
	}

	if (typing.authors) {
		lines.push('');
		lines.push(`These definitions were written by ${typing.authors}.`);
	}

	lines.push('');
	lines.push(`Typings were exported from ${typing.sourceRepoURL} in the ${typing.packageName} directory.`);

	lines.push('');
	lines.push(`Additional Details`)
	lines.push(` * Last updated: ${(new Date()).toUTCString()}`);
	lines.push(` * Typings kind: ${typing.kind}`);
	lines.push(` * Library Dependencies: ${typing.libraryDependencies.length ? typing.libraryDependencies.join(', ') : 'none'}`);
	lines.push(` * Module Dependencies: ${typing.moduleDependencies.length ? typing.moduleDependencies.join(', ') : 'none'}`);
	lines.push(` * Global values: ${typing.globals.length ? typing.globals.join(', ') : 'none'}`);
	lines.push('');

	return lines.join('\r\n');
}


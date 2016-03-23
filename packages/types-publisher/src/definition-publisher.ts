import { TypingsData, DefinitionFileKind } from './definition-parser';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as child_process from 'child_process';

const settings: PublishSettings = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));

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

		const forceUpdate = process.argv.some(arg => arg === '--forceUpdate');

		const hashValue = computeHash(key);
		let entry = data[key];

		if (entry === undefined) {
			data[key] = entry = { lastVersion: 0, lastContentHash: '' };
		}

		if (entry.lastContentHash !== hashValue || forceUpdate) {
			const vNext = entry.lastVersion + (forceUpdate ? 2 : 1);
			
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
	const pathToLibrary = /\/\/\/ <reference path="..\/(\w.+)\/.+"/gm;
	let output = input.replace(pathToLibrary, '/// <reference library="$1"');
	return output;
}

export function publish(typing: TypingsData): { log: string[] } {
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
		const packageJson = JSON.stringify(createPackageJSON(typing, version), undefined, 4);
		const readme = createReadme(typing);

		const outputPath = path.join(settings.outputPath, actualPackageName);
		mkdir(outputPath);

		fs.writeFileSync(path.join(outputPath, 'package.json'), packageJson, 'utf-8');
		fs.writeFileSync(path.join(outputPath, 'README.md'), readme, 'utf-8');

		typing.files.forEach(file => {
			log.push(`Copy and patch ${file}`);
			let content = fs.readFileSync(path.join(typing.root, file), 'utf-8');
			content = patchDefinitionFile(content);
			fs.writeFileSync(path.join(outputPath, file), content);
		});

		const args: string[] = ['npm', 'publish', path.resolve(outputPath), '--access public'];
		if (settings.tag) {
			args.push(`--tag ${settings.tag}`);
		}

		const cmd = args.join(' ');
		log.push(`Run ${cmd}`);
		try {
			const skipPublish = process.argv.some(arg => arg === '--skipPublish');
			if (skipPublish) return false;

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


function createPackageJSON(typing: TypingsData, fileVersion: number) {
	const dependencies: any = {};
	typing.moduleDependencies.forEach(d => dependencies[d] = '*');
	typing.libraryDependencies.forEach(d => dependencies[`@${settings.scopeName}/${d}`] = '*');

	let version = `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${fileVersion}`;
	if (settings.prereleaseTag) {
		version = `${version}-${settings.prereleaseTag}`;
	}

	return ({
		name: `@${settings.scopeName}/${typing.packageName.toLowerCase()}`,
		version,
		description: `Type definitions for ${typing.libraryName} from ${typing.sourceRepoURL}`,
		main: '',
		scripts: {},
		author: typing.authors,
		license: 'MIT',
		typings: typing.definitionFilename,
		dependencies
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


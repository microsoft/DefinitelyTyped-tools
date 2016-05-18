import { TypingsData, DefinitionFileKind, mkdir, settings, getOutputPath, getOutputPathByPackageName } from './common';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import * as child_process from 'child_process';
import * as request from 'request';

/** Make concrete version references */
export function shrinkwrap(typing: TypingsData) {
	const outputPath = getOutputPath(typing);

	const packageJSON = JSON.parse(fs.readFileSync(path.join(outputPath, 'package.json'), 'utf-8'));
	Object.keys(packageJSON.dependencies).forEach(depName => {
		const depPackageJSON = readPackageJSON(depName);
		if (depPackageJSON) {
			// apply concrete version
			packageJSON.dependencies[depName] = depPackageJSON['version'];
		} else {
			// delete unresolved dependency
			delete packageJSON.dependencies[depName];
		}
	});
	fs.writeFileSync(path.join(outputPath, 'package.json'), JSON.stringify(packageJSON, undefined, 4), 'utf-8');

	function readPackageJSON(typingName: string) {
		const filename = path.join(getOutputPathByPackageName(typingName), 'package.json');
		if(fs.existsSync(filename)) {
			return JSON.parse(fs.readFileSync(filename, 'utf-8'));
		} else {
			return undefined;
		}
	}
}

/** Generates the package to disk */
export function generatePackage(typing: TypingsData): { log: string[] } {
	const log: string[] = [];

	const fileVersion = Versions.computeVersion(typing);

	const outputPath = getOutputPath(typing);
	log.push(`Create output path ${outputPath}`);
	mkdir(path.dirname(outputPath));
	mkdir(outputPath);

	log.push(`Clear out old files`);
	fs.readdirSync(outputPath).forEach(file => {
		fs.unlinkSync(path.join(outputPath, file));
	});

	log.push('Generate package.json, metadata.json, and README.md');
	const packageJson = createPackageJSON(typing, fileVersion);
	const metadataJson = createMetadataJSON(typing);
	const readme = createReadme(typing);

	log.push('Write metadata files to disk');
	writeOutputFile('package.json', packageJson);
	writeOutputFile('types-metadata.json', metadataJson);
	writeOutputFile('README.md', readme);

	typing.files.forEach(file => {
		log.push(`Copy and patch ${file}`);
		let content = fs.readFileSync(path.join(typing.root, file), 'utf-8');
		content = patchDefinitionFile(content);
		writeOutputFile(file, content);
	});

	Versions.recordVersionUpdate(typing);

	return { log };

	function writeOutputFile(filename: string, content: string) {
		fs.writeFileSync(path.join(outputPath, filename), content, 'utf-8');
	}
}

function patchDefinitionFile(input: string): string {
	const pathToLibrary = /\/\/\/ <reference path="..\/(\w.+)\/.+"/gm;
	let output = input.replace(pathToLibrary, '/// <reference types="$1"');
	return output;
}

function createMetadataJSON(typing: TypingsData): string {
	const clone: typeof typing = JSON.parse(JSON.stringify(typing));
	delete clone.root;
	return JSON.stringify(clone, undefined, 4);
}

function createPackageJSON(typing: TypingsData, fileVersion: number): string {
	const dependencies: any = {};
	typing.moduleDependencies.forEach(d => dependencies[d] = '*');
	typing.libraryDependencies.forEach(d => dependencies[`@${settings.scopeName}/${d}`] = '*');

	let version = `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${fileVersion}`;
	if (settings.prereleaseTag) {
		version = `${version}-${settings.prereleaseTag}`;
	}

	return JSON.stringify({
		name: `@${settings.scopeName}/${typing.typingsPackageName.toLowerCase()}`,
		version,
		description: `Type definitions for ${typing.libraryName} from ${typing.sourceRepoURL}`,
		main: '',
		scripts: {},
		author: typing.authors,
		license: 'MIT',
		typings: typing.definitionFilename,
		dependencies
	}, undefined, 4);
}

function createReadme(typing: TypingsData) {
	const lines: string[] = [];
	lines.push('# Installation');
	lines.push('> `npm install --save-dev ' + `@${settings.scopeName}/${typing.typingsPackageName.toLowerCase()}` + '`');
	lines.push('');

	lines.push('# Summary');
	lines.push(`This package contains type definitions for ${typing.libraryName}.`)
	if (typing.projectName) {
		lines.push('');
		lines.push(`The project URL or description is ${typing.projectName}`);
	}
	lines.push('');

	lines.push('# Credits');
	if (typing.authors) {
		lines.push('');
		lines.push(`These definitions were written by ${typing.authors}.`);
	}
	lines.push('');

	lines.push('# Details');
	lines.push(`Typings were exported from ${typing.sourceRepoURL}/tree/${typing.sourceBranch}/${typing.typingsPackageName}`);

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

namespace Versions {
	const versionFilename = 'versions.json';

	interface VersionMap {
		[typingsPackageName: string]: {
			lastVersion: number;
			lastContentHash: string;
		};
	}

	let _versionData: VersionMap = undefined;
	function loadVersions() {
		if(_versionData === undefined) {
			_versionData = fs.existsSync(versionFilename) ? JSON.parse(fs.readFileSync(versionFilename, 'utf-8')) : {};
		}
		return _versionData;
	}
	function saveVersions(data: VersionMap) {
		fs.writeFileSync(versionFilename, JSON.stringify(data, undefined, 4));
	}

	export function recordVersionUpdate(typing: TypingsData) {
		const key = typing.typingsPackageName;
		const data = loadVersions();
		data[key] = { lastVersion: computeVersion(typing), lastContentHash: typing.contentHash };
		saveVersions(data);
	}

	function getLastVersion(typing: TypingsData) {
		const key = typing.typingsPackageName;
		const data = loadVersions();
		const entry = data[key];
		return entry || { lastVersion: 0, lastContentHash: '' };
	}

	export function computeVersion(typing: TypingsData): number {
		const forceUpdate = process.argv.some(arg => arg === '--forceUpdate');
		const lastVersion = getLastVersion(typing);
		const increment = (forceUpdate || (lastVersion.lastContentHash !== typing.contentHash)) ? 1 : 0;
		return lastVersion.lastVersion + increment;
	}
}

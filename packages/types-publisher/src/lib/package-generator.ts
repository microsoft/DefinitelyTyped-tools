import { TypingsData, NotNeededPackage, mkdir, settings, notNeededReadme, fullPackageName, getOutputPath } from "./common";
import * as fs from "fs";
import * as path from "path";

/** Generates the package to disk */
export function generatePackage(typing: TypingsData, availableTypes: { [name: string]: TypingsData }): { log: string[] } {
	const log: string[] = [];

	const fileVersion = Versions.computeVersion(typing);

	const outputPath = getOutputPath(typing);
	clearOutputPath(outputPath, log);

	log.push("Generate package.json, metadata.json, and README.md");
	const packageJson = createPackageJSON(typing, fileVersion, availableTypes);
	const metadataJson = createMetadataJSON(typing);
	const readme = createReadme(typing);

	log.push("Write metadata files to disk");
	writeOutputFile("package.json", packageJson);
	writeOutputFile("types-metadata.json", metadataJson);
	writeOutputFile("README.md", readme);

	typing.files.forEach(file => {
		log.push(`Copy and patch ${file}`);
		let content = fs.readFileSync(path.join(typing.root, file), "utf-8");
		content = patchDefinitionFile(content);
		writeOutputFile(file, content);
	});

	Versions.recordVersionUpdate(typing);

	return { log };

	function writeOutputFile(filename: string, content: string) {
		fs.writeFileSync(path.join(outputPath, filename), content, "utf-8");
	}
}

export function generateNotNeededPackage(pkg: NotNeededPackage): { log: string[] } {
	const log: string[] = [];
	const outputPath = getOutputPath(pkg);
	clearOutputPath(outputPath, log);

	log.push("Generate package.json and README.md");
	const packageJson = createNotNeededPackageJSON(pkg);
	const readme = notNeededReadme(pkg);

	log.push("Write metadata files to disk");
	writeOutputFile("package.json", packageJson);
	writeOutputFile("README.md", readme);

	// Not-needed packages never change version

	return { log };

	function writeOutputFile(filename: string, content: string) {
		fs.writeFileSync(path.join(outputPath, filename), content, "utf-8");
	}
}

function clearOutputPath(outputPath: string, log: string[]): void {
	log.push(`Create output path ${outputPath}`);
	mkdir(path.dirname(outputPath));
	mkdir(outputPath);

	log.push(`Clear out old files`);
	removeAllFiles(outputPath);
}

function removeAllFiles(dirPath: string): void {
	fs.readdirSync(dirPath).forEach(file => {
		fs.unlinkSync(path.join(dirPath, file));
	});
}

function patchDefinitionFile(input: string): string {
	const pathToLibrary = /\/\/\/ <reference path="..\/(\w.+)\/.+"/gm;
	let output = input.replace(pathToLibrary, '/// <reference types="$1"');
	return output;
}

function createMetadataJSON(typing: TypingsData): string {
	const replacer = (key: string, value: any) => key === "root" ? undefined : value;
	return JSON.stringify(typing, replacer, 4);
}

function createPackageJSON(typing: TypingsData, fileVersion: number, availableTypes: { [name: string]: TypingsData }): string {
	const dependencies: { [name: string]: string } = {};
	function addDependency(d: string) {
		if (availableTypes.hasOwnProperty(d)) {
			const type = availableTypes[d];
			const semver = `${type.libraryMajorVersion}.${type.libraryMinorVersion}.*`;
			dependencies[fullPackageName(d)] = semver;
		}
	}
	typing.moduleDependencies.forEach(addDependency);
	typing.libraryDependencies.forEach(addDependency);

	let version = `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${fileVersion}`;
	if (settings.prereleaseTag) {
		version = `${version}-${settings.prereleaseTag}`;
	}

	return JSON.stringify({
		name: fullPackageName(typing.typingsPackageName),
		version,
		description: `TypeScript definitions for ${typing.libraryName}`,
		main: "",
		scripts: {},
		author: typing.authors,
		repository: {
			type: "git",
			url: `${typing.sourceRepoURL}.git`
		},
		license: "MIT",
		typings: typing.definitionFilename,
		dependencies
	}, undefined, 4);
}

function createNotNeededPackageJSON({libraryName, typingsPackageName, sourceRepoURL}: NotNeededPackage): string {
	return JSON.stringify({
		name: fullPackageName(typingsPackageName),
		version: "0.0.0",
		description: `Stub TypeScript definitions entry for ${libraryName}, which provides its own types definitions`,
		main: "",
		scripts: {},
		author: "",
		repository: sourceRepoURL,
		license: "MIT",
		// No `typings`, that's provided by the dependency.
		dependencies: {
			[typingsPackageName]: "*"
		}
	}, undefined, 4);
}

function createReadme(typing: TypingsData) {
	const lines: string[] = [];
	lines.push("# Installation");
	lines.push("> `npm install --save " + fullPackageName(typing.typingsPackageName) + "`");
	lines.push("");

	lines.push("# Summary");
	if (typing.projectName) {
		lines.push(`This package contains type definitions for ${typing.libraryName} (${typing.projectName}).`);
	} else {
		lines.push(`This package contains type definitions for ${typing.libraryName}.`);
	}
	lines.push("");

	lines.push("# Details");
	lines.push(`Files were exported from ${typing.sourceRepoURL}/tree/${typing.sourceBranch}/${typing.typingsPackageName}`);

	lines.push("");
	lines.push(`Additional Details`);
	lines.push(` * Last updated: ${(new Date()).toUTCString()}`);
	lines.push(` * File structure: ${typing.kind}`);
	lines.push(` * Library Dependencies: ${typing.libraryDependencies.length ? typing.libraryDependencies.join(", ") : "none"}`);
	lines.push(` * Module Dependencies: ${typing.moduleDependencies.length ? typing.moduleDependencies.join(", ") : "none"}`);
	lines.push(` * Global values: ${typing.globals.length ? typing.globals.join(", ") : "none"}`);
	lines.push("");

	if (typing.authors) {
		lines.push("# Credits");
		lines.push(`These definitions were written by ${typing.authors}.`);
		lines.push("");
	}

	return lines.join("\r\n");
}

namespace Versions {
	const versionFilename = "versions.json";

	interface VersionMap {
		[typingsPackageName: string]: {
			lastVersion: number;
			lastContentHash: string;
		};
	}

	let _versionData: VersionMap = undefined;
	function loadVersions() {
		if (_versionData === undefined) {
			_versionData = fs.existsSync(versionFilename) ? JSON.parse(fs.readFileSync(versionFilename, "utf-8")) : {};
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
		return entry || { lastVersion: 0, lastContentHash: "" };
	}

	export function computeVersion(typing: TypingsData): number {
		const forceUpdate = process.argv.some(arg => arg === "--forceUpdate");
		const lastVersion = getLastVersion(typing);
		const increment = (forceUpdate || (lastVersion.lastContentHash !== typing.contentHash)) ? 1 : 0;
		return lastVersion.lastVersion + increment;
	}
}

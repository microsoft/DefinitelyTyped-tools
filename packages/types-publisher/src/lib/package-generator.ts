import { TypesDataFile, TypingsData, NotNeededPackage, fullPackageName, notNeededReadme, settings, getOutputPath, versionsFilename } from "./common";
import { parseJson } from "./util";
import * as fs from "fs";
import * as fsp from "fs-promise";
import * as path from "path";
import * as yargs from "yargs";

/** Generates the package to disk */
export async function generatePackage(typing: TypingsData, availableTypes: TypesDataFile): Promise<{ log: string[] }> {
	const log: string[] = [];

	const fileVersion = Versions.computeVersion(typing);

	const outputPath = getOutputPath(typing);
	await clearOutputPath(outputPath, log);

	log.push("Generate package.json, metadata.json, and README.md");
	const packageJson = createPackageJSON(typing, fileVersion, availableTypes);
	const metadataJson = createMetadataJSON(typing);
	const readme = createReadme(typing);

	log.push("Write metadata files to disk");
	const outputs = [
		writeOutputFile("package.json", packageJson),
		writeOutputFile("types-metadata.json", metadataJson),
		writeOutputFile("README.md", readme)
	];
	outputs.push(...typing.files.map(async file => {
		log.push(`Copy and patch ${file}`);
		let content = await fsp.readFile(path.join(typing.root, file), { encoding: "utf8" });
		content = patchDefinitionFile(content);
		return writeOutputFile(file, content);
	}));
	outputs.push(Versions.recordVersionUpdate(typing));

	await Promise.all(outputs);
	return { log };

	function writeOutputFile(filename: string, content: string): Promise<void> {
		return fsp.writeFile(path.join(outputPath, filename), content, { encoding: "utf8" });
	}
}

export async function generateNotNeededPackage(pkg: NotNeededPackage): Promise<{ log: string[] }> {
	const log: string[] = [];
	const outputPath = getOutputPath(pkg);
	await clearOutputPath(outputPath, log);

	log.push("Generate package.json and README.md");
	const packageJson = createNotNeededPackageJSON(pkg);
	const readme = notNeededReadme(pkg);

	log.push("Write metadata files to disk");
	await writeOutputFile("package.json", packageJson);
	await writeOutputFile("README.md", readme);

	// Not-needed packages never change version

	return { log };

	function writeOutputFile(filename: string, content: string): Promise<void> {
		return fsp.writeFile(path.join(outputPath, filename), content, { encoding: "utf8" });
	}
}

async function clearOutputPath(outputPath: string, log: string[]): Promise<void> {
	log.push(`Create output path ${outputPath}`);
	await fsp.mkdirp(outputPath);

	log.push(`Clear out old files`);
	await removeAllFiles(outputPath);
}

async function removeAllFiles(dirPath: string): Promise<void> {
	const files = await fsp.readdir(dirPath);
	await Promise.all(files.map(file => fsp.unlink(path.join(dirPath, file))));
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
			_versionData = fs.existsSync(versionFilename) ? parseJson(fs.readFileSync(versionFilename, "utf-8")) : {};
		}
		return _versionData;
	}
	function saveVersions(data: VersionMap): Promise<void> {
		return fsp.writeFile(versionsFilename, JSON.stringify(data, undefined, 4), { encoding: "utf8" });
	}

	export async function recordVersionUpdate(typing: TypingsData): Promise<void> {
		const key = typing.typingsPackageName;
		const data = loadVersions();
		data[key] = { lastVersion: computeVersion(typing), lastContentHash: typing.contentHash };
		await saveVersions(data);
	}

	function getLastVersion(typing: TypingsData) {
		const key = typing.typingsPackageName;
		const data = loadVersions();
		const entry = data[key];
		return entry || { lastVersion: 0, lastContentHash: "" };
	}

	export function computeVersion(typing: TypingsData): number {
		const forceUpdate = yargs.argv.forceUpdate;
		const lastVersion = getLastVersion(typing);
		const increment = (forceUpdate || (lastVersion.lastContentHash !== typing.contentHash)) ? 1 : 0;
		return lastVersion.lastVersion + increment;
	}
}

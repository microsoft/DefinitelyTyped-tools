import * as fsp from "fs-promise";
import * as path from "path";

import { readFile, readJson, writeFile } from "../util/io";
import { Log, Logger, quietLogger } from "../util/logging";
import { hasOwnProperty } from "../util/util";

import { AnyPackage, Options, TypesDataFile, TypingsData, NotNeededPackage, filePath, fullPackageName, notNeededReadme, getOutputPath } from "./common";
import Versions, { Semver, VersionInfo, versionString } from "./versions";

/** Generates the package to disk */
export default function generateAnyPackage(pkg: AnyPackage, availableTypes: TypesDataFile, versions: Versions, options: Options): Promise<Log> {
	return pkg.packageKind === "not-needed" ? generateNotNeededPackage(pkg, versions) : generatePackage(pkg, availableTypes, versions, options);
}

async function generatePackage(typing: TypingsData, availableTypes: TypesDataFile, versions: Versions, options: Options): Promise<Log> {
	const [log, logResult] = quietLogger();

	const outputPath = getOutputPath(typing);
	await clearOutputPath(outputPath, log);

	log("Generate package.json, metadata.json, and README.md");
	const packageJson = await createPackageJSON(typing, versions.versionInfo(typing), availableTypes, options);
	const metadataJson = createMetadataJSON(typing);
	const readme = createReadme(typing);

	log("Write metadata files to disk");
	const outputs = [
		writeOutputFile("package.json", packageJson),
		writeOutputFile("types-metadata.json", metadataJson),
		writeOutputFile("README.md", readme)
	];
	outputs.push(...typing.files.map(async file => {
		log(`Copy and patch ${file}`);
		let content = await readFile(filePath(typing, file, options));
		content = patchDefinitionFile(content);
		return writeOutputFile(file, content);
	}));

	await Promise.all(outputs);
	return logResult();

	async function writeOutputFile(filename: string, content: string): Promise<void> {
		const full = path.join(outputPath, filename);
		const dir = path.dirname(full);
		if (dir !== outputPath) {
			await fsp.mkdirp(dir);
		}
		return await writeFile(full, content);
	}
}

async function generateNotNeededPackage(pkg: NotNeededPackage, versions: Versions): Promise<string[]> {
	const [log, logResult] = quietLogger();
	const outputPath = getOutputPath(pkg);
	await clearOutputPath(outputPath, log);

	log("Generate package.json and README.md");
	const packageJson = createNotNeededPackageJSON(pkg, versions.versionInfo(pkg).version);
	const readme = notNeededReadme(pkg);

	log("Write metadata files to disk");
	await writeOutputFile("package.json", packageJson);
	await writeOutputFile("README.md", readme);

	// Not-needed packages never change version

	return logResult();

	function writeOutputFile(filename: string, content: string): Promise<void> {
		return writeFile(path.join(outputPath, filename), content);
	}
}

export async function clearOutputPath(outputPath: string, log: Logger): Promise<void> {
	log(`Create output path ${outputPath}`);
	await fsp.mkdirp(outputPath);

	log(`Clear out old files`);
	await fsp.emptyDir(outputPath);
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

interface Dependencies { [name: string]: string; }

interface PartialPackageJson {
	dependencies?: Dependencies;
	peerDependencies?: Dependencies;
	description?: string;
}

async function createPackageJSON(typing: TypingsData, { version, contentHash }: VersionInfo, availableTypes: TypesDataFile, options: Options): Promise<string> {
	// typing may provide a partial `package.json` for us to complete
	const pkgPath = filePath(typing, "package.json", options);
	let pkg: PartialPackageJson = typing.hasPackageJson ? await readJson(pkgPath) : {};

	const dependencies = pkg.dependencies || {};
	const peerDependencies = pkg.peerDependencies || {};
	addInferredDependencies(dependencies, peerDependencies, typing, availableTypes);

	const description = pkg.description || `TypeScript definitions for ${typing.libraryName}`;

	// Use the ordering of fields from https://docs.npmjs.com/files/package.json
	const out = {
		name: fullPackageName(typing.typingsPackageName),
		version: versionString(version),
		description,
		// keywords,
		// homepage,
		// bugs,
		license: "MIT",
		author: typing.authors,
		// contributors
		main: "",
		repository: {
			type: "git",
			url: `${typing.sourceRepoURL}.git`
		},
		scripts: {},
		dependencies,
		peerDependencies,
		typesPublisherContentHash: contentHash
	};

	return JSON.stringify(out, undefined, 4);
}

/** Adds inferred dependencies to `dependencies`, if they are not already specified in either `dependencies` or `peerDependencies`. */
function addInferredDependencies(
	dependencies: Dependencies, peerDependencies: Dependencies, typing: TypingsData, availableTypes: TypesDataFile): void {

	function addDependency(dependency: string): void {
		const typesDependency = fullPackageName(dependency);

		// A dependency "foo" is already handled if we already have a dependency/peerDependency on the package "foo" or "@types/foo".
		function handlesDependency(deps: Dependencies): boolean {
			return hasOwnProperty(deps, dependency) || hasOwnProperty(deps, typesDependency);
		}

		if (!handlesDependency(dependencies) && !handlesDependency(peerDependencies) && hasOwnProperty(availableTypes, dependency)) {
			// 1st/2nd case: Don't add a dependency if it was specified in the package.json or if it has already been added.
			// 3rd case: If it's not a package we know of, just ignore it.
			// For example, we may have an import of "http", where the package is depending on "node" to provide that.
			dependencies[typesDependency] = "*";
			// To use a non-latest version, that version must be made explicit in the partial package.json from a DefinitelyTyped directory.
		}
	}

	typing.moduleDependencies.forEach(addDependency);
	typing.libraryDependencies.forEach(addDependency);
}

function createNotNeededPackageJSON({libraryName, typingsPackageName, sourceRepoURL}: NotNeededPackage, version: Semver): string {
	return JSON.stringify({
		name: fullPackageName(typingsPackageName),
		version: versionString(version),
		typings: null,
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

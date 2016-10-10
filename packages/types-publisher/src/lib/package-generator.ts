import { AnyPackage, TypesDataFile, TypingsData, NotNeededPackage, fullPackageName, notNeededReadme, settings, getOutputPath } from "./common";
import { Log, Logger, quietLogger } from "./logging";
import { hasOwnProperty, readFile, readJson, writeFile } from "./util";
import Versions, { VersionInfo } from "./versions";
import * as fsp from "fs-promise";
import * as path from "path";

/** Generates the package to disk */
export default function generateAnyPackage(pkg: AnyPackage, availableTypes: TypesDataFile, versions: Versions): Promise<Log> {
	return pkg.packageKind === "not-needed" ? generateNotNeededPackage(pkg) : generatePackage(pkg, availableTypes, versions);
}

async function generatePackage(typing: TypingsData, availableTypes: TypesDataFile, versions: Versions): Promise<Log> {
	const [log, logResult] = quietLogger();

	const outputPath = getOutputPath(typing);
	await clearOutputPath(outputPath, log);

	log("Generate package.json, metadata.json, and README.md");
	const packageJson = await createPackageJSON(typing, versions.versionInfo(typing), availableTypes);
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
		let content = await readFile(filePath(typing, file));
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

async function generateNotNeededPackage(pkg: NotNeededPackage): Promise<string[]> {
	const [log, logResult] = quietLogger();
	const outputPath = getOutputPath(pkg);
	await clearOutputPath(outputPath, log);

	log("Generate package.json and README.md");
	const packageJson = createNotNeededPackageJSON(pkg);
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

async function clearOutputPath(outputPath: string, log: Logger): Promise<void> {
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

function filePath(typing: TypingsData, fileName: string): string {
	return path.join(typing.root, fileName);
}

type Dependencies = { [name: string]: string };

async function createPackageJSON(typing: TypingsData, { version, contentHash }: VersionInfo, availableTypes: TypesDataFile): Promise<string> {
	// typing may provide a partial `package.json` for us to complete
	const pkgPath = filePath(typing, "package.json");
	interface PartialPackageJson {
		dependencies?: Dependencies;
		peerDependencies?: Dependencies;
		description: string;
	}
	let pkg: PartialPackageJson = typing.hasPackageJson ? await readJson(pkgPath) : {};

	const ignoredField = Object.keys(pkg).find(field => !["dependencies", "peerDependencies", "description"].includes(field));
	// Kludge: ignore "scripts" (See https://github.com/DefinitelyTyped/definition-tester/issues/35)
	if (ignoredField && ignoredField !== "scripts") {
		throw new Error(`Ignored field in ${pkgPath}: ${ignoredField}`);
	}

	const dependencies = pkg.dependencies || {};
	const peerDependencies = pkg.peerDependencies || {};
	addInferredDependencies(dependencies, peerDependencies, typing, availableTypes);

	const description = pkg.description || `TypeScript definitions for ${typing.libraryName}`;

	// Use the ordering of fields from https://docs.npmjs.com/files/package.json
	const out = {
		name: fullPackageName(typing.typingsPackageName),
		version: versionString(typing, version),
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
		typings: typing.definitionFilename,
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

function versionString(typing: TypingsData, version: number): string {
	let versionString = `${typing.libraryMajorVersion}.${typing.libraryMinorVersion}.${version}`;
	if (settings.prereleaseTag) {
		versionString = `${version}-${settings.prereleaseTag}`;
	}
	return versionString;
}

function createNotNeededPackageJSON({libraryName, typingsPackageName, sourceRepoURL, asOfVersion}: NotNeededPackage): string {
	return JSON.stringify({
		name: fullPackageName(typingsPackageName),
		version: asOfVersion || "0.0.0",
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

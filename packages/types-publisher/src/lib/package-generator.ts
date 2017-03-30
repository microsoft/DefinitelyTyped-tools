import * as fsp from "fs-promise";
import * as path from "path";

import { readJson, writeFile } from "../util/io";
import { Log, Logger, quietLogger } from "../util/logging";
import { hasOwnProperty, joinPaths } from "../util/util";

import { Options } from "./common";
import { AllPackages, AnyPackage, DependencyVersion, fullNpmName, NotNeededPackage, TypingsData } from "./packages";
import { sourceBranch } from "./settings";
import Versions, { Semver } from "./versions";

/** Generates the package to disk */
export default function generateAnyPackage(pkg: AnyPackage, packages: AllPackages, versions: Versions, options: Options): Promise<Log> {
	return pkg.isNotNeeded() ? generateNotNeededPackage(pkg, versions) : generatePackage(pkg, packages, versions, options);
}

async function generatePackage(typing: TypingsData, packages: AllPackages, versions: Versions, options: Options): Promise<Log> {
	const [log, logResult] = quietLogger();

	const outputPath = typing.outputDirectory;
	await clearOutputPath(outputPath, log);

	log("Generate package.json, metadata.json, and README.md");
	const packageJson = await createPackageJSON(typing, versions.getVersion(typing), packages, options);
	const readme = createReadme(typing);

	log("Write metadata files to disk");
	const outputs = [
		writeOutputFile("package.json", packageJson),
		writeOutputFile("README.md", readme)
	];
	outputs.push(...typing.files.map(async file => {
		log(`Copy ${file}`);
		await fsp.copy(typing.filePath(file, options), await outputFilePath(file));
	}));

	await Promise.all(outputs);
	return logResult();

	async function writeOutputFile(filename: string, content: string): Promise<void> {
		await writeFile(await outputFilePath(filename), content);
	}

	async function outputFilePath(filename: string): Promise<string> {
		const full = joinPaths(outputPath, filename);
		const dir = path.dirname(full);
		if (dir !== outputPath) {
			await fsp.mkdirp(dir);
		}
		return full;
	}
}

async function generateNotNeededPackage(pkg: NotNeededPackage, versions: Versions): Promise<string[]> {
	const [log, logResult] = quietLogger();
	const outputPath = pkg.outputDirectory;
	await clearOutputPath(outputPath, log);

	log("Generate package.json and README.md");
	const packageJson = createNotNeededPackageJSON(pkg, versions.getVersion(pkg));
	const readme = pkg.readme();

	log("Write metadata files to disk");
	await writeOutputFile("package.json", packageJson);
	await writeOutputFile("README.md", readme);

	// Not-needed packages never change version

	return logResult();

	function writeOutputFile(filename: string, content: string): Promise<void> {
		return writeFile(joinPaths(outputPath, filename), content);
	}
}

export async function clearOutputPath(outputPath: string, log: Logger): Promise<void> {
	log(`Create output path ${outputPath}`);
	await fsp.mkdirp(outputPath);

	log(`Clear out old files`);
	await fsp.emptyDir(outputPath);
}

interface Dependencies { [name: string]: string; }

export interface PartialPackageJson {
	dependencies?: Dependencies;
	peerDependencies?: Dependencies;
}

async function createPackageJSON(typing: TypingsData, version: Semver, packages: AllPackages, options: Options): Promise<string> {
	// typing may provide a partial `package.json` for us to complete
	const pkgPath = typing.filePath("package.json", options);
	const pkg: PartialPackageJson = typing.hasPackageJson ? await readJson(pkgPath) : {};

	const dependencies = pkg.dependencies || {};
	const peerDependencies = pkg.peerDependencies || {};
	addInferredDependencies(dependencies, peerDependencies, typing, packages);

	const description = `TypeScript definitions for ${typing.libraryName}`;

	// Use the ordering of fields from https://docs.npmjs.com/files/package.json
	const out = {
		name: typing.fullNpmName,
		version: version.versionString,
		description,
		// keywords,
		// homepage,
		// bugs,
		license: "MIT",
		contributors: typing.contributors,
		main: "",
		repository: {
			type: "git",
			url: `${typing.sourceRepoURL}.git`
		},
		scripts: {},
		dependencies,
		peerDependencies,
		typesPublisherContentHash: typing.contentHash,
		typeScriptVersion: typing.typeScriptVersion
	};

	return JSON.stringify(out, undefined, 4);
}

/** Adds inferred dependencies to `dependencies`, if they are not already specified in either `dependencies` or `peerDependencies`. */
function addInferredDependencies(dependencies: Dependencies, peerDependencies: Dependencies, typing: TypingsData, allPackages: AllPackages): void {
	for (const dependency of typing.dependencies) {
		const typesDependency = fullNpmName(dependency.name);

		// A dependency "foo" is already handled if we already have a dependency/peerDependency on the package "foo" or "@types/foo".
		function handlesDependency(deps: Dependencies): boolean {
			return hasOwnProperty(deps, dependency.name) || hasOwnProperty(deps, typesDependency);
		}

		if (!handlesDependency(dependencies) && !handlesDependency(peerDependencies) && allPackages.hasTypingFor(dependency)) {
			dependencies[typesDependency] = dependencySemver(dependency.majorVersion);
		}
	}
}

function dependencySemver(dependency: DependencyVersion): string {
	return dependency === "*" ? dependency : `^${dependency}`;
}

function createNotNeededPackageJSON({libraryName, name, fullNpmName, sourceRepoURL}: NotNeededPackage, version: Semver): string {
	return JSON.stringify({
		name: fullNpmName,
		version: version.versionString,
		typings: null,
		description: `Stub TypeScript definitions entry for ${libraryName}, which provides its own types definitions`,
		main: "",
		scripts: {},
		author: "",
		repository: sourceRepoURL,
		license: "MIT",
		// No `typings`, that's provided by the dependency.
		dependencies: {
			[name]: "*"
		}
	}, undefined, 4);
}

function createReadme(typing: TypingsData) {
	const lines: string[] = [];
	lines.push("# Installation");
	lines.push("> `npm install --save " + typing.fullNpmName + "`");
	lines.push("");

	lines.push("# Summary");
	if (typing.projectName) {
		lines.push(`This package contains type definitions for ${typing.libraryName} (${typing.projectName}).`);
	} else {
		lines.push(`This package contains type definitions for ${typing.libraryName}.`);
	}
	lines.push("");

	lines.push("# Details");
	lines.push(`Files were exported from ${typing.sourceRepoURL}/tree/${sourceBranch}/types/${typing.subDirectoryPath}`);

	lines.push("");
	lines.push(`Additional Details`);
	lines.push(` * Last updated: ${(new Date()).toUTCString()}`);
	const dependencies = Array.from(typing.dependencies).map(d => d.name);
	lines.push(` * Dependencies: ${dependencies.length ? dependencies.join(", ") : "none"}`);
	lines.push(` * Global values: ${typing.globals.length ? typing.globals.join(", ") : "none"}`);
	lines.push("");

	lines.push("# Credits");
	const contributors = typing.contributors.map(({ name, url }) => `${name} <${url}>`).join(", ");
	lines.push(`These definitions were written by ${contributors}.`);
	lines.push("");

	return lines.join("\r\n");
}

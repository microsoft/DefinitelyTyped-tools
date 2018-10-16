import { makeTypesVersionsForPackageJson } from "definitelytyped-header-parser";
import { mkdir, mkdirp, readFileSync } from "fs-extra";
import * as path from "path";

import { FS } from "../get-definitely-typed";
import { writeFile } from "../util/io";
import { Log, quietLogger } from "../util/logging";
import { assertNever, hasOwnProperty, joinPaths } from "../util/util";

import { AllPackages, AnyPackage, DependencyVersion, fullNpmName, License, NotNeededPackage, TypingsData } from "./packages";
import { sourceBranch } from "./settings";
import Versions, { Semver } from "./versions";

/** Generates the package to disk */
export default function generateAnyPackage(pkg: AnyPackage, packages: AllPackages, versions: Versions, dt: FS): Promise<Log> {
	return pkg.isNotNeeded() ? generateNotNeededPackage(pkg, versions) : generatePackage(pkg, packages, versions.getVersion(pkg), dt);
}

const mitLicense = readFileSync(joinPaths(__dirname, "..", "..", "LICENSE"), "utf-8");

async function generatePackage(typing: TypingsData, packages: AllPackages, version: Semver, dt: FS): Promise<Log> {
	const [log, logResult] = quietLogger();

	const typesDirectory = dt.subDir("types").subDir(typing.name);
	const packageFS = typing.isLatest ? typesDirectory : typesDirectory.subDir(`v${version.major}`);

	const packageJson = await createPackageJSON(typing, version, packages);
	log("Write metadata files to disk");
	await writeCommonOutputs(typing, packageJson, createReadme(typing));
	await Promise.all(typing.files.map(async file => {
		log(`Copy ${file}`);
		await writeFile(await outputFilePath(typing, file), await packageFS.readFile(file));
	}));
	return logResult();
}

async function generateNotNeededPackage(pkg: NotNeededPackage, versions: Versions): Promise<string[]> {
	const [log, logResult] = quietLogger();

	const packageJson = createNotNeededPackageJSON(pkg, versions.getVersion(pkg));
	log("Write metadata files to disk");
	await writeCommonOutputs(pkg, packageJson, pkg.readme());

	return logResult();
}

async function writeCommonOutputs(pkg: AnyPackage, packageJson: string, readme: string): Promise<void> {
	await mkdir(pkg.outputDirectory);

	await Promise.all([
		writeOutputFile("package.json", packageJson),
		writeOutputFile("README.md", readme),
		writeOutputFile("LICENSE", getLicenseFileText(pkg)),
	]);

	async function writeOutputFile(filename: string, content: string): Promise<void> {
		await writeFile(await outputFilePath(pkg, filename), content);
	}
}

async function outputFilePath(pkg: AnyPackage, filename: string): Promise<string> {
	const full = joinPaths(pkg.outputDirectory, filename);
	const dir = path.dirname(full);
	if (dir !== pkg.outputDirectory) {
		await mkdirp(dir);
	}
	return full;
}

interface Dependencies { [name: string]: string; }

async function createPackageJSON(typing: TypingsData, version: Semver, packages: AllPackages): Promise<string> {
	// typing may provide a partial `package.json` for us to complete
	const dependencies = getDependencies(typing.packageJsonDependencies, typing, packages);

	// Use the ordering of fields from https://docs.npmjs.com/files/package.json
	const out: {} = {
		name: typing.fullNpmName,
		version: version.versionString,
		description: `TypeScript definitions for ${typing.libraryName}`,
		// keywords,
		// homepage,
		// bugs,
		license: typing.license,
		contributors: typing.contributors,
		main: "",
		types: "",
		typesVersions:  makeTypesVersionsForPackageJson(typing.typesVersions),
		repository: {
			type: "git",
			url: `${definitelyTypedURL}.git`
		},
		scripts: {},
		dependencies,
		typesPublisherContentHash: typing.contentHash,
		typeScriptVersion: typing.minTypeScriptVersion
	};

	return JSON.stringify(out, undefined, 4);
}

const definitelyTypedURL = "https://github.com/DefinitelyTyped/DefinitelyTyped";

/** Adds inferred dependencies to `dependencies`, if they are not already specified in either `dependencies` or `peerDependencies`. */
function getDependencies(
	packageJsonDependencies: ReadonlyArray<{ name: string, version: string }>,
	typing: TypingsData,
	allPackages: AllPackages): Dependencies {
	const dependencies: Dependencies = {};
	for (const { name, version } of packageJsonDependencies) {
		dependencies[name] = version;
	}

	for (const dependency of typing.dependencies) {
		const typesDependency = fullNpmName(dependency.name);

		// A dependency "foo" is already handled if we already have a dependency on the package "foo" or "@types/foo".
		function handlesDependency(deps: Dependencies): boolean {
			return hasOwnProperty(deps, dependency.name) || hasOwnProperty(deps, typesDependency);
		}

		if (!handlesDependency(dependencies) && allPackages.hasTypingFor(dependency)) {
			dependencies[typesDependency] = dependencySemver(dependency.majorVersion);
		}
	}
	return dependencies;
}

function dependencySemver(dependency: DependencyVersion): string {
	return dependency === "*" ? dependency : `^${dependency}`;
}

function createNotNeededPackageJSON({libraryName, license, name, fullNpmName, sourceRepoURL }: NotNeededPackage, version: Semver): string {
	return JSON.stringify(
		{
			name: fullNpmName,
			version: version.versionString,
			typings: null, // tslint:disable-line no-null-keyword
			description: `Stub TypeScript definitions entry for ${libraryName}, which provides its own types definitions`,
			main: "",
			scripts: {},
			author: "",
			repository: sourceRepoURL,
			license,
			// No `typings`, that's provided by the dependency.
			dependencies: {
				[name]: "*"
			}
		},
		undefined,
		4);
}

function createReadme(typing: TypingsData): string {
	const lines: string[] = [];
	lines.push("# Installation");
	lines.push(`> \`npm install --save ${typing.fullNpmName}\``);
	lines.push("");

	lines.push("# Summary");
	if (typing.projectName) {
		lines.push(`This package contains type definitions for ${typing.libraryName} (${typing.projectName}).`);
	} else {
		lines.push(`This package contains type definitions for ${typing.libraryName}.`);
	}
	lines.push("");

	lines.push("# Details");
	lines.push(`Files were exported from ${definitelyTypedURL}/tree/${sourceBranch}/types/${typing.subDirectoryPath}`);

	lines.push("");
	lines.push("Additional Details");
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

function getLicenseFileText(typing: AnyPackage): string {
	switch (typing.license) {
		case License.MIT:
			return mitLicense;
		case License.Apache20:
			return apacheLicense(typing);
		default:
			throw assertNever(typing);
	}
}

function apacheLicense(typing: TypingsData): string {
	const year = new Date().getFullYear();
	const names = typing.contributors.map(c => c.name);
	// tslint:disable max-line-length
	return `Copyright ${year} ${names.join(", ")}
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`;
	// tslint:enable max-line-length
}

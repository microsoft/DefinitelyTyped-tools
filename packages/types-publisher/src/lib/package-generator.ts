import { makeTypesVersionsForPackageJson } from "definitelytyped-header-parser";
import { mkdir, mkdirp, readFileSync } from "fs-extra";
import * as path from "path";

import { FS } from "../get-definitely-typed";
import { writeFile } from "../util/io";
import { assertNever, joinPaths, sortObjectKeys } from "../util/util";

import {
    AllPackages, AnyPackage, DependencyVersion, getFullNpmName, License, NotNeededPackage, PackageJsonDependency, TypingsData,
} from "./packages";
import { sourceBranch } from "./settings";

const mitLicense = readFileSync(joinPaths(__dirname, "..", "..", "LICENSE"), "utf-8");

export async function generateTypingPackage(typing: TypingsData, packages: AllPackages, version: string, dt: FS): Promise<void> {
    const typesDirectory = dt.subDir("types").subDir(typing.name);
    const packageFS = typing.isLatest ? typesDirectory : typesDirectory.subDir(`v${typing.major}`);

    const packageJson = createPackageJSON(typing, version, packages);
    await writeCommonOutputs(typing, packageJson, createReadme(typing));
    await Promise.all(typing.files.
                      map(async file => writeFile(await outputFilePath(typing, file), await packageFS.readFile(file))));
}

export async function generateNotNeededPackage(pkg: NotNeededPackage): Promise<void> {
    const packageJson = createNotNeededPackageJSON(pkg);
    await writeCommonOutputs(pkg, packageJson, pkg.readme());
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

function createPackageJSON(typing: TypingsData, version: string, packages: AllPackages): string {
    // Use the ordering of fields from https://docs.npmjs.com/files/package.json
    const out: {} = {
        name: typing.fullNpmName,
        version,
        description: `TypeScript definitions for ${typing.libraryName}`,
        // keywords,
        // homepage,
        // bugs,
        license: typing.license,
        contributors: typing.contributors,
        main: "",
        types: "index",
        typesVersions:  makeTypesVersionsForPackageJson(typing.typesVersions),
        repository: {
            type: "git",
            url: `${definitelyTypedURL}.git`,
        },
        scripts: {},
        dependencies: getDependencies(typing.packageJsonDependencies, typing, packages),
        typesPublisherContentHash: typing.contentHash,
        typeScriptVersion: typing.minTypeScriptVersion,
    };

    return JSON.stringify(out, undefined, 4);
}

const definitelyTypedURL = "https://github.com/DefinitelyTyped/DefinitelyTyped";

/** Adds inferred dependencies to `dependencies`, if they are not already specified in either `dependencies` or `peerDependencies`. */
function getDependencies(packageJsonDependencies: ReadonlyArray<PackageJsonDependency>, typing: TypingsData, allPackages: AllPackages): Dependencies {
    const dependencies: Dependencies = {};
    for (const { name, version } of packageJsonDependencies) {
        dependencies[name] = version;
    }

    for (const dependency of typing.dependencies) {
        const typesDependency = getFullNpmName(dependency.name);
        // A dependency "foo" is already handled if we already have a dependency on the package "foo" or "@types/foo".
        if (!packageJsonDependencies.some(d => d.name === dependency.name || d.name === typesDependency) && allPackages.hasTypingFor(dependency)) {
            dependencies[typesDependency] = dependencySemver(dependency.majorVersion);
        }
    }
    return sortObjectKeys(dependencies);
}

function dependencySemver(dependency: DependencyVersion): string {
    return dependency === "*" ? dependency : `^${dependency}`;
}

function createNotNeededPackageJSON({ libraryName, license, name, fullNpmName, sourceRepoURL, version }: NotNeededPackage): string {
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
                [name]: "*",
            },
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
    const dependencies = Array.from(typing.dependencies).map(d => getFullNpmName(d.name));
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

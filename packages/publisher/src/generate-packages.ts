import { makeTypesVersionsForPackageJson } from "@definitelytyped/header-parser";
import { emptyDir, mkdir, mkdirp, readFileSync } from "fs-extra";
import path = require("path");
import yargs = require("yargs");

import { defaultLocalOptions } from "./lib/common";
import { outputDirPath, sourceBranch } from "./lib/settings";
import {
  assertNever,
  joinPaths,
  logUncaughtErrors,
  sortObjectKeys,
  loggerWithErrors,
  FS,
  logger,
  writeLog,
  writeFile,
  Logger,
  cacheDir,
  writeTgz,
} from "@definitelytyped/utils";
import {
  getDefinitelyTyped,
  AllPackages,
  TypingsData,
  NotNeededPackage,
  AnyPackage,
  PackageJsonDependency,
  getFullNpmName,
  DependencyVersion,
  License,
  formatTypingVersion,
} from "@definitelytyped/definitions-parser";
import * as pacote from "pacote";
import { readChangedPackages, ChangedPackages } from "./lib/versions";
import { outputDirectory } from "./util/util";
import { skipBadPublishes } from "./lib/npm";

const mitLicense = readFileSync(joinPaths(__dirname, "..", "LICENSE"), "utf-8");

if (!module.parent) {
  const tgz = !!yargs.argv.tgz;
  logUncaughtErrors(async () => {
    const log = loggerWithErrors()[0];
    const dt = await getDefinitelyTyped(defaultLocalOptions, log);
    const allPackages = await AllPackages.read(dt);
    await generatePackages(dt, allPackages, await readChangedPackages(allPackages), tgz);
  });
}

export default async function generatePackages(
  dt: FS,
  allPackages: AllPackages,
  changedPackages: ChangedPackages,
  tgz = false
): Promise<void> {
  const [log, logResult] = logger();
  log("\n## Generating packages");

  await mkdirp(outputDirPath);
  await emptyDir(outputDirPath);

  for (const { pkg, version } of changedPackages.changedTypings) {
    await generateTypingPackage(pkg, allPackages, version, dt);
    if (tgz) {
      await writeTgz(outputDirectory(pkg), `${outputDirectory(pkg)}.tgz`);
    }
    log(` * ${pkg.desc}`);
  }
  log("## Generating deprecated packages");
  for (const pkg of changedPackages.changedNotNeededPackages) {
    log(` * ${pkg.libraryName}`);
    await generateNotNeededPackage(pkg, log);
  }
  await writeLog("package-generator.md", logResult());
}
async function generateTypingPackage(
  typing: TypingsData,
  packages: AllPackages,
  version: string,
  dt: FS
): Promise<void> {
  const typesDirectory = dt.subDir("types").subDir(typing.name);
  const packageFS =
    typing.isLatest || !typing.versionDirectoryName
      ? typesDirectory
      : typesDirectory.subDir(typing.versionDirectoryName);

  await writeCommonOutputs(typing, createPackageJSON(typing, version, packages), createReadme(typing, packageFS));
  await Promise.all(
    typing.files.map(async (file) => writeFile(await outputFilePath(typing, file), packageFS.readFile(file)))
  );
}

async function generateNotNeededPackage(pkg: NotNeededPackage, log: Logger): Promise<void> {
  pkg = await skipBadPublishes(pkg, log);
  const info = await pacote.manifest(pkg.libraryName, { cache: cacheDir, fullMetadata: true });
  const readme = `This is a stub types definition for ${getFullNpmName(pkg.name)} (${info.homepage}).\n
${pkg.libraryName} provides its own type definitions, so you don't need ${getFullNpmName(pkg.name)} installed!`;
  await writeCommonOutputs(pkg, createNotNeededPackageJSON(pkg), readme);
}

async function writeCommonOutputs(pkg: AnyPackage, packageJson: string, readme: string): Promise<void> {
  await mkdir(outputDirectory(pkg));

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
  const full = joinPaths(outputDirectory(pkg), filename);
  const dir = path.dirname(full);
  if (dir !== outputDirectory(pkg)) {
    await mkdirp(dir);
  }
  return full;
}

interface Dependencies {
  [name: string]: string;
}

export function createPackageJSON(typing: TypingsData, version: string, packages: AllPackages): string {
  // Use the ordering of fields from https://docs.npmjs.com/files/package.json
  const out: {} = {
    name: typing.fullNpmName,
    version,
    description: `TypeScript definitions for ${typing.libraryName}`,
    // keywords,
    homepage: `https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/${typing.name}`,
    // bugs,
    license: typing.license,
    contributors: typing.contributors,
    main: "",
    types: "index.d.ts",
    typesVersions: makeTypesVersionsForPackageJson(typing.typesVersions),
    repository: {
      type: "git",
      url: "https://github.com/DefinitelyTyped/DefinitelyTyped.git",
      directory: `types/${typing.name}`,
    },
    scripts: {},
    dependencies: getDependencies(typing.packageJsonDependencies, typing, packages),
    typesPublisherContentHash: typing.contentHash,
    typeScriptVersion: typing.minTypeScriptVersion,
  };
  const exports = typing.exports;
  if (exports) {
    (out as any).exports = exports;
  }
  const imports = typing.imports;
  if (imports) {
    (out as any).imports = imports;
  }
  const type = typing.type;
  if (type) {
    (out as any).type = type;
  }

  return JSON.stringify(out, undefined, 4);
}

const definitelyTypedURL = "https://github.com/DefinitelyTyped/DefinitelyTyped";

/** Adds inferred dependencies to `dependencies`, if they are not already specified in either `dependencies` or `peerDependencies`. */
function getDependencies(
  packageJsonDependencies: readonly PackageJsonDependency[],
  typing: TypingsData,
  allPackages: AllPackages
): Dependencies {
  const dependencies: Dependencies = {};
  for (const { name, version } of packageJsonDependencies) {
    dependencies[name] = version;
  }

  for (const [name, version] of Object.entries(typing.dependencies)) {
    const typesDependency = getFullNpmName(name);
    // A dependency "foo" is already handled if we already have a dependency on the package "foo" or "@types/foo".
    if (
      !packageJsonDependencies.some((d) => d.name === name || d.name === typesDependency) &&
      allPackages.hasTypingFor({ name, version })
    ) {
      dependencies[typesDependency] = dependencySemver(version);
    }
  }
  return sortObjectKeys(dependencies);
}

function dependencySemver(dependency: DependencyVersion): string {
  return dependency === "*" ? dependency : "^" + formatTypingVersion(dependency);
}

export function createNotNeededPackageJSON(pkg: NotNeededPackage): string {
  const out = {
    name: pkg.fullNpmName,
    version: String(pkg.version),
    description: `Stub TypeScript definitions entry for ${pkg.libraryName}, which provides its own types definitions`,
    main: "",
    scripts: {},
    license: pkg.license,
    // No `typings`, that's provided by the dependency.
    dependencies: {
      [pkg.libraryName]: "*",
    },
    deprecated: pkg.deprecatedMessage(),
  };
  return JSON.stringify(out, undefined, 4);
}

export function createReadme(typing: TypingsData, packageFS: FS): string {
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
  lines.push(`Files were exported from ${definitelyTypedURL}/tree/${sourceBranch}/types/${typing.subDirectoryPath}.`);

  if (typing.dtsFiles.length === 1 && packageFS.readFile(typing.dtsFiles[0]).length < 2500) {
    const dts = typing.dtsFiles[0];
    const url = `${definitelyTypedURL}/tree/${sourceBranch}/types/${typing.subDirectoryPath}/${dts}`;
    lines.push(`## [${typing.dtsFiles[0]}](${url})`);
    lines.push("````ts");
    lines.push(packageFS.readFile(dts));
    lines.push("````");
  }

  lines.push("");
  lines.push("### Additional Details");
  lines.push(` * Last updated: ${new Date().toUTCString()}`);
  const dependencies = Object.keys(typing.dependencies).map(getFullNpmName).sort();
  lines.push(
    ` * Dependencies: ${
      dependencies.length ? dependencies.map((d) => `[${d}](https://npmjs.com/package/${d})`).join(", ") : "none"
    }`
  );
  lines.push(` * Global values: ${typing.globals.length ? typing.globals.map((g) => `\`${g}\``).join(", ") : "none"}`);
  lines.push("");

  lines.push("# Credits");
  const contributors = typing.contributors
    .map(({ name, url }) => `[${name}](${url})`)
    .join(", ")
    .replace(/, ([^,]+)$/, ", and $1");
  lines.push(`These definitions were written by ${contributors}.`);
  lines.push("");

  return lines.join("\r\n");
}

export function getLicenseFileText(typing: AnyPackage): string {
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
  const names = typing.contributors.map((c) => c.name);
  // tslint:disable max-line-length
  return `Copyright ${year} ${names.join(", ")}
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`;
  // tslint:enable max-line-length
}

import { makeTypesVersionsForPackageJson } from "@definitelytyped/header-parser";
import { emptyDir, mkdir, mkdirp, readFileSync } from "fs-extra";
import * as path from "path";
import * as yargs from "yargs";

import { defaultLocalOptions } from "./lib/common";
import { outputDirPath, sourceBranch, cacheDirPath } from "./lib/settings";
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
  writeTgz,
  withNpmCache,
  UncachedNpmInfoClient,
  Registry,
  CachedNpmInfoClient
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
  formatTypingVersion
} from "@definitelytyped/definitions-parser";
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
  await withNpmCache(
    new UncachedNpmInfoClient(),
    async client => {
      for (const pkg of changedPackages.changedNotNeededPackages) {
        log(` * ${pkg.libraryName}`);
        await generateNotNeededPackage(pkg, client, log);
      }
    },
    cacheDirPath
  );
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

  await writeCommonOutputs(
    typing,
    createPackageJSON(typing, version, packages, Registry.NPM),
    createReadme(typing),
    Registry.NPM
  );
  await writeCommonOutputs(
    typing,
    createPackageJSON(typing, version, packages, Registry.Github),
    createReadme(typing),
    Registry.Github
  );
  await Promise.all(
    typing.files.map(async file =>
      writeFile(await outputFilePath(typing, Registry.NPM, file), packageFS.readFile(file))
    )
  );
  await Promise.all(
    typing.files.map(async file =>
      writeFile(await outputFilePath(typing, Registry.Github, file), packageFS.readFile(file))
    )
  );
}

async function generateNotNeededPackage(
  pkg: NotNeededPackage,
  client: CachedNpmInfoClient,
  log: Logger
): Promise<void> {
  pkg = skipBadPublishes(pkg, client, log);
  await writeCommonOutputs(pkg, createNotNeededPackageJSON(pkg, Registry.NPM), pkg.readme(), Registry.NPM);
  await writeCommonOutputs(pkg, createNotNeededPackageJSON(pkg, Registry.Github), pkg.readme(), Registry.Github);
}

async function writeCommonOutputs(
  pkg: AnyPackage,
  packageJson: string,
  readme: string,
  registry: Registry
): Promise<void> {
  await mkdir(outputDirectory(pkg) + (registry === Registry.Github ? "-github" : ""));

  await Promise.all([
    writeOutputFile("package.json", packageJson),
    writeOutputFile("README.md", readme),
    writeOutputFile("LICENSE", getLicenseFileText(pkg))
  ]);

  async function writeOutputFile(filename: string, content: string): Promise<void> {
    await writeFile(await outputFilePath(pkg, registry, filename), content);
  }
}

async function outputFilePath(pkg: AnyPackage, registry: Registry, filename: string): Promise<string> {
  const full = joinPaths(outputDirectory(pkg) + (registry === Registry.Github ? "-github" : ""), filename);
  const dir = path.dirname(full);
  if (dir !== outputDirectory(pkg)) {
    await mkdirp(dir);
  }
  return full;
}

interface Dependencies {
  [name: string]: string;
}

export function createPackageJSON(
  typing: TypingsData,
  version: string,
  packages: AllPackages,
  registry: Registry
): string {
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
    types: "index.d.ts",
    typesVersions: makeTypesVersionsForPackageJson(typing.typesVersions),
    repository: {
      type: "git",
      url:
        registry === Registry.Github
          ? "https://github.com/types/_definitelytypedmirror.git"
          : "https://github.com/DefinitelyTyped/DefinitelyTyped.git",
      directory: `types/${typing.name}`
    },
    scripts: {},
    dependencies: getDependencies(typing.packageJsonDependencies, typing, packages),
    typesPublisherContentHash: typing.contentHash,
    typeScriptVersion: typing.minTypeScriptVersion
  };
  if (registry === Registry.Github) {
    (out as any).publishConfig = { registry: "https://npm.pkg.github.com/" };
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

  for (const dependency of typing.dependencies) {
    const typesDependency = getFullNpmName(dependency.name);
    // A dependency "foo" is already handled if we already have a dependency on the package "foo" or "@types/foo".
    if (
      !packageJsonDependencies.some(d => d.name === dependency.name || d.name === typesDependency) &&
      allPackages.hasTypingFor(dependency)
    ) {
      dependencies[typesDependency] = dependencySemver(dependency.version);
    }
  }
  return sortObjectKeys(dependencies);
}

function dependencySemver(dependency: DependencyVersion): string {
  return dependency === "*" ? dependency : "^" + formatTypingVersion(dependency);
}

export function createNotNeededPackageJSON(
  { libraryName, license, unescapedName, fullNpmName, sourceRepoURL, version }: NotNeededPackage,
  registry: Registry
): string {
  const out = {
    name: fullNpmName,
    version: version.versionString,
    typings: null, // tslint:disable-line no-null-keyword
    description: `Stub TypeScript definitions entry for ${libraryName}, which provides its own types definitions`,
    main: "",
    scripts: {},
    author: "",
    repository: registry === Registry.NPM ? sourceRepoURL : "https://github.com/types/_definitelytypedmirror.git",
    license,
    // No `typings`, that's provided by the dependency.
    dependencies: {
      [unescapedName]: "*"
    }
  };
  if (registry === Registry.Github) {
    (out as any).publishConfig = { registry: "https://npm.pkg.github.com/" };
  }
  return JSON.stringify(out, undefined, 4);
}

export function createReadme(typing: TypingsData): string {
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

  lines.push("");
  lines.push("### Additional Details");
  lines.push(` * Last updated: ${new Date().toUTCString()}`);
  const dependencies = Array.from(typing.dependencies).map(d => getFullNpmName(d.name));
  lines.push(
    ` * Dependencies: ${
      dependencies.length ? dependencies.map(d => `[${d}](https://npmjs.com/package/${d})`).join(", ") : "none"
    }`
  );
  lines.push(` * Global values: ${typing.globals.length ? typing.globals.map(g => `\`${g}\``).join(", ") : "none"}`);
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
  const names = typing.contributors.map(c => c.name);
  // tslint:disable max-line-length
  return `Copyright ${year} ${names.join(", ")}
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.`;
  // tslint:enable max-line-length
}

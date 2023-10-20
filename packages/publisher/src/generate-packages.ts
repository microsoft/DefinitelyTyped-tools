import { makeTypesVersionsForPackageJson, License } from "@definitelytyped/header-parser";
import { emptyDir, mkdir, mkdirp, readFileSync } from "fs-extra";
import path = require("path");
import yargs = require("yargs");

import {
  AllPackages,
  AnyPackage,
  NotNeededPackage,
  TypingsData,
  getAllowedPackageJsonDependencies,
  getDefinitelyTyped,
} from "@definitelytyped/definitions-parser";
import {
  FS,
  Logger,
  assertNever,
  cacheDir,
  joinPaths,
  logUncaughtErrors,
  logger,
  loggerWithErrors,
  nAtATime,
  writeFile,
  writeLog,
  writeTgz,
} from "@definitelytyped/utils";
import * as pacote from "pacote";
import { defaultLocalOptions } from "./lib/common";
import { skipBadPublishes } from "./lib/npm";
import { outputDirPath, sourceBranch } from "./lib/settings";
import { ChangedPackages, readChangedPackages } from "./lib/versions";
import { outputDirectory } from "./util/util";

const mitLicense = readFileSync(joinPaths(__dirname, "..", "LICENSE"), "utf-8");

if (require.main === module) {
  const tgz = !!yargs.argv.tgz;
  logUncaughtErrors(async () => {
    const log = loggerWithErrors()[0];
    const options = { ...defaultLocalOptions };
    if (yargs.argv.path) {
      options.definitelyTypedPath = yargs.argv.path as string;
    }
    const dt = await getDefinitelyTyped(options, log);
    const allPackages = AllPackages.fromFS(dt);
    await generatePackages(dt, await readChangedPackages(allPackages), tgz);
  });
}

export default async function generatePackages(dt: FS, changedPackages: ChangedPackages, tgz = false): Promise<void> {
  const [log, logResult] = logger();
  log("\n## Generating packages");

  await mkdirp(outputDirPath);
  await emptyDir(outputDirPath);

  // warm the cache so we don't request this from GH concurrently
  await getAllowedPackageJsonDependencies();

  await nAtATime(10, changedPackages.changedTypings, async ({ pkg, version }) => {
    await generateTypingPackage(pkg, version, dt);
    if (tgz) {
      await writeTgz(outputDirectory(pkg), `${outputDirectory(pkg)}.tgz`);
    }
    log(` * ${pkg.desc}`);
  });

  log("## Generating deprecated packages");
  for (const pkg of changedPackages.changedNotNeededPackages) {
    log(` * ${pkg.libraryName}`);
    await generateNotNeededPackage(pkg, log);
  }
  await writeLog("package-generator.md", logResult());
}
async function generateTypingPackage(typing: TypingsData, version: string, dt: FS): Promise<void> {
  const typesDirectory = dt.subDir("types").subDir(typing.typesDirectoryName);
  const packageFS =
    typing.isLatest || !typing.versionDirectoryName
      ? typesDirectory
      : typesDirectory.subDir(typing.versionDirectoryName);

  await writeCommonOutputs(typing, createPackageJSON(typing, version), createReadme(typing, packageFS));
  await Promise.all(
    typing.getFiles().map(async (file) => writeFile(await outputFilePath(typing, file), packageFS.readFile(file)))
  );
}

async function generateNotNeededPackage(pkg: NotNeededPackage, log: Logger): Promise<void> {
  pkg = await skipBadPublishes(pkg, log);
  const info = await pacote.manifest(pkg.libraryName, { cache: cacheDir, fullMetadata: true });
  const readme = `This is a stub types definition for ${pkg.name} (${info.homepage}).\n
${pkg.libraryName} provides its own type definitions, so you don't need ${pkg.name} installed!`;
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

export function createPackageJSON(typing: TypingsData, version: string): string {
  // Use the ordering of fields from https://docs.npmjs.com/files/package.json
  const out: {} = {
    name: typing.name,
    version,
    description: `TypeScript definitions for ${typing.libraryName}`,
    // keywords,
    homepage: `https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/${typing.typesDirectoryName}`,
    // bugs,
    license: typing.license,
    contributors: typing.contributors,
    type: typing.type,
    main: "",
    types: "index.d.ts",
    typesVersions: makeTypesVersionsForPackageJson(typing.typesVersions),
    imports: typing.imports,
    exports: typing.exports,
    repository: {
      type: "git",
      url: "https://github.com/DefinitelyTyped/DefinitelyTyped.git",
      directory: `types/${typing.typesDirectoryName}`,
    },
    scripts: {},
    dependencies: typing.dependencies,
    typesPublisherContentHash: typing.getContentHash(),
    typeScriptVersion: typing.minTypeScriptVersion,
    nonNpm: typing.nonNpm === true ? typing.nonNpm : undefined,
  };

  return JSON.stringify(out, undefined, 4);
}

const definitelyTypedURL = "https://github.com/DefinitelyTyped/DefinitelyTyped";

export function createNotNeededPackageJSON(pkg: NotNeededPackage): string {
  const out = {
    name: pkg.name,
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
  lines.push(`> \`npm install --save ${typing.name}\``);
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

  const dtsFiles = typing.getDtsFiles();
  if (dtsFiles.length === 1 && packageFS.readFile(dtsFiles[0]).length < 2500) {
    const dts = dtsFiles[0];
    const url = `${definitelyTypedURL}/tree/${sourceBranch}/types/${typing.subDirectoryPath}/${dts}`;
    lines.push(`## [${dtsFiles[0]}](${url})`);
    lines.push("````ts");
    lines.push(packageFS.readFile(dts));
    lines.push("````");
  }

  lines.push("");
  lines.push("### Additional Details");
  lines.push(` * Last updated: ${new Date().toUTCString()}`);
  const dependencies = Object.keys(typing.dependencies).sort();
  lines.push(
    ` * Dependencies: ${
      dependencies.length ? dependencies.map((d) => `[${d}](https://npmjs.com/package/${d})`).join(", ") : "none"
    }`
  );
  lines.push("");

  lines.push("# Credits");
  const contributors = typing.contributors
    .map((c) => `[${c.name}](${c.url})`)
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

import fs = require("fs");
import yargs = require("yargs");
import headerParser = require("@definitelytyped/header-parser");
import path = require("path");
import cp = require("child_process");
import {
  dtsCritic,
  dtToNpmName,
  getNpmInfo,
  parseExportErrorKind,
  CriticError,
  ExportErrorKind,
  Mode,
  checkSource,
  findDtsName,
  CheckOptions,
  parseMode,
} from "./index";

const sourcesDir = "sources";
const downloadsPath = path.join(sourcesDir, "dts-critic-internal/downloads.json");
const isNpmPath = path.join(sourcesDir, "dts-critic-internal/npm.json");

function getPackageDownloads(dtName: string): number {
  const npmName = dtToNpmName(dtName);
  const url = `https://api.npmjs.org/downloads/point/last-month/${npmName}`;
  const result = JSON.parse(cp.execFileSync("curl", ["--silent", "-L", url], { encoding: "utf8" })) as {
    downloads?: number;
  };
  return result.downloads || 0;
}

interface DownloadsJson {
  [key: string]: number | undefined;
}

function getAllPackageDownloads(dtPath: string): DownloadsJson {
  if (fs.existsSync(downloadsPath)) {
    return JSON.parse(fs.readFileSync(downloadsPath, { encoding: "utf8" })) as DownloadsJson;
  }

  initDir(path.dirname(downloadsPath));
  const downloads: DownloadsJson = {};
  const dtTypesPath = getDtTypesPath(dtPath);
  for (const item of fs.readdirSync(dtTypesPath)) {
    const d = getPackageDownloads(item);
    downloads[item] = d;
  }
  fs.writeFileSync(downloadsPath, JSON.stringify(downloads), { encoding: "utf8" });

  return downloads;
}

function initDir(path: string): void {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
}

function getDtTypesPath(dtBasePath: string): string {
  return path.join(dtBasePath, "types");
}

function compareDownloads(downloads: DownloadsJson, package1: string, package2: string): number {
  const count1 = downloads[package1] || 0;
  const count2 = downloads[package2] || 0;
  return count1 - count2;
}

interface IsNpmJson {
  [key: string]: boolean | undefined;
}

function getAllIsNpm(dtPath: string): IsNpmJson {
  if (fs.existsSync(isNpmPath)) {
    return JSON.parse(fs.readFileSync(isNpmPath, { encoding: "utf8" })) as IsNpmJson;
  }
  initDir(path.dirname(isNpmPath));
  const isNpm: IsNpmJson = {};
  const dtTypesPath = getDtTypesPath(dtPath);
  for (const item of fs.readdirSync(dtTypesPath)) {
    isNpm[item] = getNpmInfo(item).isNpm;
  }
  fs.writeFileSync(isNpmPath, JSON.stringify(isNpm), { encoding: "utf8" });
  return isNpm;
}

function getPopularNpmPackages(count: number, dtPath: string): string[] {
  const dtPackages = getDtNpmPackages(dtPath);
  const downloads = getAllPackageDownloads(dtPath);
  dtPackages.sort((a, b) => compareDownloads(downloads, a, b));
  return dtPackages.slice(dtPackages.length - count);
}

function getUnpopularNpmPackages(count: number, dtPath: string): string[] {
  const dtPackages = getDtNpmPackages(dtPath);
  const downloads = getAllPackageDownloads(dtPath);
  dtPackages.sort((a, b) => compareDownloads(downloads, a, b));
  return dtPackages.slice(0, count);
}

function getDtNpmPackages(dtPath: string): string[] {
  const dtPackages = fs.readdirSync(getDtTypesPath(dtPath));
  const isNpmJson = getAllIsNpm(dtPath);
  return dtPackages.filter((pkg) => isNpmPackage(pkg, /* header */ undefined, isNpmJson));
}

function getNonNpm(args: { dtPath: string }): void {
  const nonNpm: string[] = [];
  const dtTypesPath = getDtTypesPath(args.dtPath);
  const isNpmJson = getAllIsNpm(args.dtPath);
  for (const item of fs.readdirSync(dtTypesPath)) {
    const entry = path.join(dtTypesPath, item);
    const dts = fs.readFileSync(entry + "/index.d.ts", "utf8");
    let header;
    try {
      header = headerParser.parseHeaderOrFail(dts);
    } catch (e) {
      header = undefined;
    }
    if (!isNpmPackage(item, header, isNpmJson)) {
      nonNpm.push(item);
    }
  }
  console.log(`List of non-npm packages on DT:\n${nonNpm.map((name) => `DT name: ${name}\n`).join("")}`);
}

interface CommonArgs {
  dtPath: string;
  mode: string;
  enableError: string[] | undefined;
  debug: boolean;
  json: boolean;
}

function checkAll(args: CommonArgs): void {
  const dtPackages = fs.readdirSync(getDtTypesPath(args.dtPath));
  checkPackages({ packages: dtPackages, ...args });
}

function checkPopular(args: { count: number } & CommonArgs): void {
  checkPackages({ packages: getPopularNpmPackages(args.count, args.dtPath), ...args });
}

function checkUnpopular(args: { count: number } & CommonArgs): void {
  checkPackages({ packages: getUnpopularNpmPackages(args.count, args.dtPath), ...args });
}

function checkPackages(args: { packages: string[] } & CommonArgs): void {
  const results = args.packages.map((pkg) => doCheck({ package: pkg, ...args }));
  printResults(results, args.json);
}

function checkPackage(args: { package: string } & CommonArgs): void {
  printResults([doCheck(args)], args.json);
}

function doCheck(args: {
  package: string;
  dtPath: string;
  mode: string;
  enableError: string[] | undefined;
  debug: boolean;
}): Result {
  const dtPackage = args.package;
  const opts = getOptions(args.mode, args.enableError || []);
  try {
    const dtsPath = path.join(getDtTypesPath(args.dtPath), dtPackage, "index.d.ts");
    const errors = dtsCritic(dtsPath, /* sourcePath */ undefined, opts, args.debug);
    return { package: args.package, output: errors };
  } catch (e) {
    return { package: args.package, output: (e as Error).toString() };
  }
}

function getOptions(modeArg: string, enabledErrors: string[]): CheckOptions {
  const mode = parseMode(modeArg);
  if (!mode) {
    throw new Error(`Could not find mode named '${modeArg}'.`);
  }
  switch (mode) {
    case Mode.NameOnly:
      return { mode };
    case Mode.Code:
      const errors = getEnabledErrors(enabledErrors);
      return { mode, errors };
  }
}

function getEnabledErrors(errorNames: string[]): Map<ExportErrorKind, boolean> {
  const errors: ExportErrorKind[] = [];
  for (const name of errorNames) {
    const error = parseExportErrorKind(name);
    if (error === undefined) {
      throw new Error(`Could not find error named '${name}'.`);
    }
    errors.push(error);
  }
  return new Map(errors.map((err) => [err, true]));
}

function checkFile(args: { jsFile: string; dtsFile: string; debug: boolean }): void {
  console.log(`\tChecking JS file ${args.jsFile} and declaration file ${args.dtsFile}`);
  try {
    const errors = checkSource(findDtsName(args.dtsFile), args.dtsFile, args.jsFile, new Map(), args.debug);
    console.log(formatErrors(errors));
  } catch (e) {
    console.log(e);
  }
}

interface Result {
  package: string;
  output: CriticError[] | string;
}

function printResults(results: Result[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(results));
    return;
  }

  for (const result of results) {
    console.log(`\tChecking package ${result.package} ...`);
    if (typeof result.output === "string") {
      console.log(`Exception:\n${result.output}`);
    } else {
      console.log(formatErrors(result.output));
    }
  }
}

function formatErrors(errors: CriticError[]): string {
  const lines: string[] = [];
  for (const error of errors) {
    lines.push("Error: " + error.message);
  }
  if (errors.length === 0) {
    lines.push("No errors found! :)");
  }
  return lines.join("\n");
}

function isNpmPackage(name: string, header?: headerParser.Header, isNpmJson: IsNpmJson = {}): boolean {
  if (header && header.nonNpm) return false;
  const isNpm = isNpmJson[name];
  if (isNpm !== undefined) {
    return isNpm;
  }
  return getNpmInfo(name).isNpm;
}

function main() {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  yargs
    .usage("$0 <command>")
    .command(
      "check-all",
      "Check source and declaration of all DT packages that are on NPM.",
      {
        dtPath: {
          type: "string",
          default: "../DefinitelyTyped",
          describe: "Path of DT repository cloned locally.",
        },
        mode: {
          type: "string",
          required: true,
          choices: [Mode.NameOnly, Mode.Code],
          describe: "Mode that defines which group of checks will be made.",
        },
        enableError: {
          type: "array",
          string: true,
          describe: "Enable checking for a specific export error.",
        },
        debug: {
          type: "boolean",
          default: false,
          describe: "Turn debug logging on.",
        },
        json: {
          type: "boolean",
          default: false,
          describe: "Format output result as json.",
        },
      },
      checkAll
    )
    .command(
      "check-popular",
      "Check source and declaration of most popular DT packages that are on NPM.",
      {
        count: {
          alias: "c",
          type: "number",
          required: true,
          describe: "Number of packages to be checked.",
        },
        dtPath: {
          type: "string",
          default: "../DefinitelyTyped",
          describe: "Path of DT repository cloned locally.",
        },
        mode: {
          type: "string",
          required: true,
          choices: [Mode.NameOnly, Mode.Code],
          describe: "Mode that defines which group of checks will be made.",
        },
        enableError: {
          type: "array",
          string: true,
          describe: "Enable checking for a specific export error.",
        },
        debug: {
          type: "boolean",
          default: false,
          describe: "Turn debug logging on.",
        },
        json: {
          type: "boolean",
          default: false,
          describe: "Format output result as json.",
        },
      },
      checkPopular
    )
    .command(
      "check-unpopular",
      "Check source and declaration of least popular DT packages that are on NPM.",
      {
        count: {
          alias: "c",
          type: "number",
          required: true,
          describe: "Number of packages to be checked.",
        },
        dtPath: {
          type: "string",
          default: "../DefinitelyTyped",
          describe: "Path of DT repository cloned locally.",
        },
        mode: {
          type: "string",
          required: true,
          choices: [Mode.NameOnly, Mode.Code],
          describe: "Mode that defines which group of checks will be made.",
        },
        enableError: {
          type: "array",
          string: true,
          describe: "Enable checking for a specific export error.",
        },
        debug: {
          type: "boolean",
          default: false,
          describe: "Turn debug logging on.",
        },
        json: {
          type: "boolean",
          default: false,
          describe: "Format output result as json.",
        },
      },
      checkUnpopular
    )
    .command(
      "check-package",
      "Check source and declaration of a DT package.",
      {
        package: {
          alias: "p",
          type: "string",
          required: true,
          describe: "DT name of a package.",
        },
        dtPath: {
          type: "string",
          default: "../DefinitelyTyped",
          describe: "Path of DT repository cloned locally.",
        },
        mode: {
          type: "string",
          required: true,
          choices: [Mode.NameOnly, Mode.Code],
          describe: "Mode that defines which group of checks will be made.",
        },
        enableError: {
          type: "array",
          string: true,
          describe: "Enable checking for a specific export error.",
        },
        debug: {
          type: "boolean",
          default: false,
          describe: "Turn debug logging on.",
        },
        json: {
          type: "boolean",
          default: false,
          describe: "Format output result as json.",
        },
      },
      checkPackage
    )
    .command(
      "check-file",
      "Check a JavaScript file and its matching declaration file.",
      {
        jsFile: {
          alias: "j",
          type: "string",
          required: true,
          describe: "Path of JavaScript file.",
        },
        dtsFile: {
          alias: "d",
          type: "string",
          required: true,
          describe: "Path of declaration file.",
        },
        debug: {
          type: "boolean",
          default: false,
          describe: "Turn debug logging on.",
        },
      },
      checkFile
    )
    .command(
      "get-non-npm",
      "Get list of DT packages whose source package is not on NPM",
      {
        dtPath: {
          type: "string",
          default: "../DefinitelyTyped",
          describe: "Path of DT repository cloned locally.",
        },
      },
      getNonNpm
    )
    .demandCommand(1)
    .help().argv;
}
main();

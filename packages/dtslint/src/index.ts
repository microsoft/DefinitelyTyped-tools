#!/usr/bin/env node

import { getTypesVersions } from "@definitelytyped/header-parser";
import { AllTypeScriptVersion, TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { assertNever, deepEquals, readJson } from "@definitelytyped/utils";
import fs from "fs";
import os from "os";
import { basename, dirname, join as joinPaths, resolve } from "path";
import { satisfies } from "semver";
import { pipeline } from "stream/promises";
import tar from "tar";
import { createGunzip } from "zlib";
import { checkPackageJson, checkTsconfig, runAreTheTypesWrong } from "./checks";
import { TsVersion, lint } from "./lint";
import { getCompilerOptions, packageDirectoryNameWithVersionFromPath, packageNameFromPath } from "./util";
import assert = require("assert");

const tmpDir = os.tmpdir();
const npmVersionExemptions = new Set(
  fs.readFileSync(joinPaths(__dirname, "../expectedNpmVersionFailures.txt"), "utf-8").split(/\r?\n/),
);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let dirPath = process.cwd();
  let onlyTestTsNext = false;
  let expectOnly = false;
  let skipNpmChecks = false;
  let shouldListen = false;
  let lookingForTsLocal = false;
  let tsLocal: string | undefined;

  console.log(`dtslint@${require("../package.json").version}`);
  if (args.length === 1 && args[0] === "types") {
    console.log(
      "Please provide a package name to test.\nTo test all changed packages at once, run `pnpm run test-all`.",
    );
    process.exit(1);
  }

  for (const arg of args) {
    if (lookingForTsLocal) {
      if (arg.startsWith("--")) {
        throw new Error("Looking for local path for TS, but got " + arg);
      }
      tsLocal = resolve(arg);
      lookingForTsLocal = false;
      continue;
    }
    switch (arg) {
      case "--localTs":
        lookingForTsLocal = true;
        break;
      case "--version":
        console.log(require("../../package.json").version);
        return;
      case "--expectOnly":
        expectOnly = true;
        break;
      case "--skipNpmChecks":
        skipNpmChecks = true;
        break;
      case "--onlyTestTsNext":
        onlyTestTsNext = true;
        break;
      // Only for use by types-publisher.
      // Listens for { path, onlyTestTsNext } messages and outputs { path, status }.
      case "--listen":
        shouldListen = true;
        break;
      default: {
        if (arg.startsWith("--")) {
          console.error(`Unknown option '${arg}'`);
          usage();
          process.exit(1);
        }

        const path =
          arg.indexOf("@") === 0 && arg.indexOf("/") !== -1
            ? // we have a scoped module, e.g. @bla/foo
              // which should be converted to   bla__foo
              arg.slice(1).replace("/", "__")
            : arg;
        dirPath = joinPaths(dirPath, path);
      }
    }
  }
  if (lookingForTsLocal) {
    throw new Error("Path for --localTs was not provided.");
  }

  if (shouldListen) {
    listen(dirPath, tsLocal);
  } else {
    await runTests(dirPath, onlyTestTsNext, expectOnly, skipNpmChecks, tsLocal);
  }
}

function usage(): void {
  console.error("Usage: dtslint [--version] [--onlyTestTsNext] [--expectOnly] [--localTs path] [--skipNpmChecks]");
  console.error("Args:");
  console.error("  --version        Print version and exit.");
  console.error("  --expectOnly     Run only the ExpectType lint rule.");
  console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
  console.error("  --localTs path   Run with *path* as the latest version of TS.");
  console.error("  --skipNpmChecks  Don't query npm - skips name/version checks and @arethetypeswrong/cli.");
  console.error("");
  console.error("onlyTestTsNext and localTs are (1) mutually exclusive and (2) test a single version of TS");
}

function listen(dirPath: string, tsLocal: string | undefined): void {
  // Don't await this here to ensure that messages sent during installation aren't dropped.
  process.on("message", async (message: unknown) => {
    const { path, onlyTestTsNext, expectOnly, skipNpmChecks } = message as {
      path: string;
      onlyTestTsNext: boolean;
      expectOnly?: boolean;
      skipNpmChecks?: boolean;
    };

    runTests(joinPaths(dirPath, path), onlyTestTsNext, !!expectOnly, !!skipNpmChecks, tsLocal)
      .then(
        () => process.send!({ path, status: "OK" }),
        (e) => process.send!({ path, status: e.stack }),
      )
      .catch((e) => console.error(e.stack));
  });
}

/**
 * @returns Warning text - should be displayed during the run, but does not indicate failure.
 */
async function runTests(
  dirPath: string,
  onlyTestTsNext: boolean,
  expectOnly: boolean,
  skipNpmChecks: boolean,
  tsLocal: string | undefined,
): Promise<string | undefined> {
  // Assert that we're really on DefinitelyTyped.
  const dtRoot = findDTRoot(dirPath);
  const packageName = packageNameFromPath(dirPath);
  const packageDirectoryNameWithVersion = packageDirectoryNameWithVersionFromPath(dirPath);
  assertPathIsInDefinitelyTyped(dirPath, dtRoot);
  assertPathIsNotBanned(packageName);
  assertPackageIsNotDeprecated(
    packageName,
    await fs.promises.readFile(joinPaths(dtRoot, "notNeededPackages.json"), "utf-8"),
  );

  const typesVersions = getTypesVersions(dirPath);
  const packageJson = checkPackageJson(dirPath, typesVersions);
  if (Array.isArray(packageJson)) {
    throw new Error("\n\t* " + packageJson.join("\n\t* "));
  }

  await assertNpmIgnoreExpected(dirPath);
  assertNoOtherFiles(dirPath);

  let implementationPackage;
  let warnings: string[] | undefined;
  let errors: string[] | undefined;
  let hasNpmVersionMismatch = false;

  if (!skipNpmChecks && !expectOnly) {
    const attw = await import("@arethetypeswrong/core");
    const typesPackageVersion = `${packageJson.libraryMajorVersion}.${packageJson.libraryMinorVersion}`;
    const pkg = await tryPromise(
      attw.resolveImplementationPackageForTypesPackage(packageJson.name, `${typesPackageVersion}.9999`),
    );
    if (pkg) {
      const { packageName, packageVersion, tarballUrl } = pkg;
      if (packageJson.nonNpm === true) {
        (errors ??= []).push(
          `Package ${packageJson.name} is marked as non-npm, but ${packageName} exists on npm. ` +
            `If these types are being added to DefinitelyTyped for the first time, please choose ` +
            `a different name that does not conflict with an existing npm package.`,
        );
      } else if (!packageJson.nonNpm) {
        if (!satisfies(packageVersion, typesPackageVersion)) {
          hasNpmVersionMismatch = true;
          const isError = !npmVersionExemptions.has(packageDirectoryNameWithVersion);
          const container = isError ? (errors ??= []) : (warnings ??= []);
          container.push(
            (isError
              ? ""
              : `Ignoring npm version error because ${packageDirectoryNameWithVersion} was failing when the check was added. ` +
                `If you are making changes to this package, please fix this error:\n> `) +
              `Cannot find a version of ${packageName} on npm that matches the types version ${typesPackageVersion}. ` +
              `The closest match found was ${packageName}@${packageVersion}. ` +
              `If these types are for the existing npm package ${packageName}, change the ${packageDirectoryNameWithVersion}/package.json ` +
              `major and minor version to match an existing version of the npm package. If these types are unrelated to ` +
              `the npm package ${packageName}, add \`"nonNpm": true\` to the package.json and choose a different name ` +
              `that does not conflict with an existing npm package.`,
          );
        } else {
          const tarballPath = joinPaths(tmpDir, `${packageName.replace(/\//g, "-")}-${packageVersion}.tgz`);
          const unpackedPath = joinPaths(tmpDir, `${packageName}-${packageVersion}`);
          await pipeline((await fetch(tarballUrl)).body!, fs.createWriteStream(tarballPath));
          await fs.promises.mkdir(unpackedPath, { recursive: true });
          await pipeline(fs.createReadStream(tarballPath), createGunzip(), tar.extract({ cwd: unpackedPath }));
          const containerDir = (await fs.promises.readdir(unpackedPath))[0];
          implementationPackage = {
            packageName,
            packageVersion,
            tarballPath,
            unpackedPath: joinPaths(unpackedPath, containerDir),
          };
        }
      }
    } else {
      if (packageJson.nonNpm === "conflict") {
        (errors ??= []).push(
          `Package ${packageJson.name} is marked as \`"nonNpm": "conflict"\`, but no conflicting package name was ` +
            `found on npm. These non-npm types can be makred as \`"nonNpm": true\` instead.`,
        );
      } else if (!packageJson.nonNpm) {
        (errors ??= []).push(
          `Package ${packageJson.name} is not marked as non-npm, but no implementation package was found on npm. ` +
            `If these types are not for an npm package, please add \`"nonNpm": true\` to the package.json. ` +
            `Otherwise, ensure the name of this package matches the name of the npm package.`,
        );
      }
    }
  }

  const minVersion = maxVersion(packageJson.minimumTypeScriptVersion, TypeScriptVersion.lowest);
  if (onlyTestTsNext || tsLocal) {
    const tsVersion = tsLocal ? "local" : TypeScriptVersion.latest;
    await testTypesVersion(dirPath, tsVersion, tsVersion, expectOnly, tsLocal, /*isLatest*/ true);
  } else {
    // For example, typesVersions of [3.2, 3.5, 3.6] will have
    // associated ts3.2, ts3.5, ts3.6 directories, for
    // <=3.2, <=3.5, <=3.6 respectively; the root level is for 3.7 and above.
    // so this code needs to generate ranges [lowest-3.2, 3.3-3.5, 3.6-3.6, 3.7-latest]
    const lows = [TypeScriptVersion.lowest, ...typesVersions.map(next)];
    const his = [...typesVersions, TypeScriptVersion.latest];
    assert.strictEqual(lows.length, his.length);
    for (let i = 0; i < lows.length; i++) {
      const low = maxVersion(minVersion, lows[i]);
      const hi = his[i];
      assert(
        parseFloat(hi) >= parseFloat(low),
        `'"minimumTypeScriptVersion": "${minVersion}"' in package.json skips ts${hi} folder.`,
      );
      const isLatest = hi === TypeScriptVersion.latest;
      const versionPath = isLatest ? dirPath : joinPaths(dirPath, `ts${hi}`);
      if (lows.length > 1) {
        console.log("testing from", low, "to", hi, "in", versionPath);
      }
      await testTypesVersion(versionPath, low, hi, expectOnly, undefined, isLatest);
    }
  }

  if (implementationPackage) {
    const attwJson = joinPaths(dtRoot, "attw.json");
    const failingPackages = ((await readJson(attwJson)) as any).failingPackages;
    const dirName = dirPath.slice(dtRoot.length + "/types/".length);
    const expectError = !!failingPackages?.includes(dirName);
    const { output, status } = runAreTheTypesWrong(dirPath, implementationPackage.tarballPath, attwJson);

    if (expectError) {
      switch (status) {
        case "error":
          // No need to bother anyone with a version mismatch error or non-failure error.
          break;
        case "fail":
          // Show output without failing the build.
          (warnings ??= []).push(
            `Ignoring attw failure because "${dirName}" is listed in 'failingPackages'.\n\n@arethetypeswrong/cli\n${output}`,
          );
          break;
        case "pass":
          (errors ??= []).push(`attw passed: remove "${dirName}" from 'failingPackages' in attw.json\n\n${output}`);
          break;
        default:
          assertNever(status);
      }
    } else {
      switch (status) {
        case "error":
        case "fail":
          (errors ??= []).push(`!@arethetypeswrong/cli\n${output}`);
          break;
        case "pass":
          // Don't show anything for passing attw - most lint rules have no output on success.
          break;
      }
    }
  }

  if (
    !skipNpmChecks &&
    !expectOnly &&
    !hasNpmVersionMismatch &&
    npmVersionExemptions.has(packageDirectoryNameWithVersion)
  ) {
    (warnings ??= []).push(`${packageDirectoryNameWithVersion} can be removed from expectedNpmVersionFailures.txt in https://github.com/microsoft/DefinitelyTyped-tools/blob/main/packages/dtslint.`);
  }

  const result = combineErrorsAndWarnings(errors, warnings);
  if (result instanceof Error) {
    throw result;
  }
  return result;
}

function combineErrorsAndWarnings(
  errors: string[] | undefined,
  warnings: string[] | undefined,
): Error | string | undefined {
  if (!errors && !warnings) {
    return undefined;
  }
  const message = (errors ?? []).concat(warnings ?? []).join("\n\n");
  return errors?.length ? new Error(message) : message;
}

function maxVersion(v1: AllTypeScriptVersion, v2: TypeScriptVersion): TypeScriptVersion {
  // Note: For v1 to be later than v2, it must be a current Typescript version. So the type assertion is safe.
  return parseFloat(v1) >= parseFloat(v2) ? (v1 as TypeScriptVersion) : v2;
}

function next(v: TypeScriptVersion): TypeScriptVersion {
  const index = TypeScriptVersion.supported.indexOf(v);
  assert.notStrictEqual(index, -1);
  assert(index < TypeScriptVersion.supported.length);
  return TypeScriptVersion.supported[index + 1];
}

async function testTypesVersion(
  dirPath: string,
  lowVersion: TsVersion,
  hiVersion: TsVersion,
  expectOnly: boolean,
  tsLocal: string | undefined,
  isLatest: boolean,
): Promise<void> {
  assertIndexdts(dirPath);
  const tsconfigErrors = checkTsconfig(dirPath, getCompilerOptions(dirPath));
  if (tsconfigErrors.length > 0) {
    throw new Error("\n\t* " + tsconfigErrors.join("\n\t* "));
  }
  const err = await lint(dirPath, lowVersion, hiVersion, isLatest, expectOnly, tsLocal);
  if (err) {
    throw new Error(err);
  }
}

function findDTRoot(dirPath: string) {
  let path = dirPath;
  while (basename(path) !== "types" && dirname(path) !== "." && dirname(path) !== "/") {
    path = dirname(path);
  }
  return dirname(path);
}

function assertPathIsInDefinitelyTyped(dirPath: string, dtRoot: string): void {
  // TODO: It's not clear whether this assertion makes sense, and it's broken on Azure Pipelines (perhaps because DT isn't cloned into DefinitelyTyped)
  // Re-enable it later if it makes sense.
  // if (basename(dtRoot) !== "DefinitelyTyped")) {
  if (!fs.existsSync(joinPaths(dtRoot, "types"))) {
    throw new Error(
      "Since this type definition includes a header (a comment starting with `// Type definitions for`), " +
        "assumed this was a DefinitelyTyped package.\n" +
        "But it is not in a `DefinitelyTyped/types/xxx` directory: " +
        dirPath,
    );
  }
}

/**
 * Starting at some point in time, npm has banned all new packages whose names
 * contain the word `download`. However, some older packages exist that still
 * contain this name.
 * @NOTE for contributors: The list of literal exceptions below should ONLY be
 * extended with packages for which there already exists a corresponding type
 * definition package in the `@types` scope. More information:
 * https://github.com/microsoft/DefinitelyTyped-tools/pull/381.
 */
function assertPathIsNotBanned(packageName: string) {
  if (
    /(^|\W)download($|\W)/.test(packageName) &&
    packageName !== "download" &&
    packageName !== "downloadjs" &&
    packageName !== "s3-download-stream"
  ) {
    // Since npm won't release their banned-words list, we'll have to manually add to this list.
    throw new Error(`${packageName}: Contains the word 'download', which is banned by npm.`);
  }
}

export function assertPackageIsNotDeprecated(packageName: string, notNeededPackages: string) {
  const unneeded = JSON.parse(notNeededPackages).packages;
  if (Object.keys(unneeded).includes(packageName)) {
    throw new Error(`${packageName}: notNeededPackages.json has an entry for ${packageName}.
That means ${packageName} ships its own types, and @types/${packageName} was deprecated and removed from Definitely Typed.
If you want to re-add @types/${packageName}, please remove its entry from notNeededPackages.json.`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack);
    process.exit(1);
  });
}

async function assertNpmIgnoreExpected(dirPath: string) {
  const expected = ["*", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts", "!**/*.d.*.ts"];

  if (basename(dirname(dirPath)) === "types") {
    for (const subdir of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (subdir.isDirectory() && /^v(\d+)(\.(\d+))?$/.test(subdir.name)) {
        expected.push(`/${subdir.name}/`);
      }
    }
  }

  const expectedString = expected.join("\n");

  const npmIgnorePath = joinPaths(dirPath, ".npmignore");
  if (!fs.existsSync(npmIgnorePath)) {
    throw new Error(`${dirPath}: Missing '.npmignore'; should contain:\n${expectedString}`);
  }

  const actualRaw = await fs.promises.readFile(npmIgnorePath, "utf-8");
  const actual = actualRaw.trim().split(/\r?\n/);

  if (!deepEquals(actual, expected)) {
    throw new Error(`${dirPath}: Incorrect '.npmignore'; should be:\n${expectedString}`);
  }
}

function assertNoOtherFiles(dirPath: string) {
  if (fs.existsSync(joinPaths(dirPath, "OTHER_FILES.txt"))) {
    throw new Error(
      `${dirPath}: Should not contain 'OTHER_FILES.txt'. All files matching "**/*.d.{ts,cts,mts,*.ts}" are automatically included.`,
    );
  }
}

function tryPromise<T>(promise: Promise<T>): Promise<T | undefined> {
  return promise.catch(() => undefined);
}

function assertIndexdts(dirPath: string) {
  if (!fs.existsSync(joinPaths(dirPath, "index.d.ts"))) {
    throw new Error(`${dirPath}: Must contain 'index.d.ts'.`);
  }
}

#!/usr/bin/env node
import { isTypeScriptVersion, parseTypeScriptVersionLine, TypeScriptVersion } from "definitelytyped-header-parser";
import { pathExists, readdir, readFile, stat } from "fs-extra";
import { basename, dirname, join as joinPaths } from "path";

import critic = require("dts-critic");
import { checkPackageJson, checkTsconfig } from "./checks";
import { cleanInstalls, installAll, installNext } from "./installer";
import { checkTslintJson, lint, TsVersion } from "./lint";
import { assertDefined, last, mapDefinedAsync, readJson, withoutPrefix } from "./util";

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    let dirPath = process.cwd();
    let onlyTestTsNext = false;
    let expectOnly = false;
    let shouldListen = false;

    for (const arg of args) {
        switch (arg) {
            case "--installAll":
                console.log("Cleaning old installs and installing for all TypeScript versions...");
                console.log("Working...");
                await cleanInstalls();
                await installAll();
                return;

            case "--version":
                console.log(require("../package.json").version);
                return;
            case "--expectOnly":
                expectOnly = true;
                break;

            case "--onlyTestTsNext":
                onlyTestTsNext = true;
                break;

            // Only for use by types-publisher.
            // Listens for { path, onlyTestTsNext } messages and ouputs { path, status }.
            case "--listen":
                shouldListen = true;
                break;

            default:
                if (arg.startsWith("--")) {
                    console.error(`Unknown option '${arg}'`);
                    usage();
                    process.exit(1);
                }

                const path = arg.indexOf("@") === 0 && arg.indexOf("/") !== -1
                    // we have a scoped module, e.g. @bla/foo
                    // which should be converted to   bla__foo
                    ? arg.substr(1).replace("/", "__")
                    : arg;
                dirPath = joinPaths(dirPath, path);
        }
    }

    if (shouldListen) {
        listen(dirPath);
        // Do this *after* to ensure messages sent during installation aren't dropped.
        await installAll();
    } else {
        if (onlyTestTsNext) {
            await installNext();
        } else {
            await installAll();
        }
        await runTests(dirPath, onlyTestTsNext, expectOnly);
    }
}

function usage(): void {
    console.error("Usage: dtslint [--version] [--installAll]");
    console.error("Args:");
    console.error("  --version        Print version and exit.");
    console.error("  --installAll     Cleans and installs all TypeScript versions.");
    console.error("  --onlyTestTsNext Only run with `typescript@next`, not with the minimum version.");
}

function listen(dirPath: string): void {
    process.on("message", (message: {}) => {
        const { path, onlyTestTsNext, expectOnly } = message as { path: string, onlyTestTsNext: boolean, expectOnly?: boolean };
        runTests(joinPaths(dirPath, path), onlyTestTsNext, !!expectOnly)
            .catch(e => e.stack)
            .then(maybeError => {
                process.send!({ path, status: maybeError === undefined ? "OK" : maybeError });
            })
            .catch(e => console.error(e.stack));
    });
}

async function runTests(dirPath: string, onlyTestTsNext: boolean, expectOnly: boolean): Promise<void> {
    const isOlderVersion = /^v\d+$/.test(basename(dirPath));

    const indexText = await readFile(joinPaths(dirPath, "index.d.ts"), "utf-8");
    // If this *is* on DefinitelyTyped, types-publisher will fail if it can't parse the header.
    const dt = indexText.includes("// Type definitions for");
    if (dt) {
        // Someone may have copied text from DefinitelyTyped to their type definition and included a header,
        // so assert that we're really on DefinitelyTyped.
        assertPathIsInDefinitelyTyped(dirPath);
    }

    const typesVersions = await mapDefinedAsync(await readdir(dirPath), async name => {
        if (name === "tsconfig.json" || name === "tslint.json" || name === "tsutils") { return undefined; }
        const version = withoutPrefix(name, "ts");
        if (version === undefined || !(await stat(joinPaths(dirPath, name))).isDirectory()) { return undefined; }

        if (!isTypeScriptVersion(version)) {
            throw new Error(`There is an entry named ${name}, but ${version} is not a valid TypeScript version.`);
        }
        if (!TypeScriptVersion.isRedirectable(version)) {
            throw new Error(`At ${dirPath}/${name}: TypeScript version directories only available starting with ts3.1.`);
        }
        return version;
    });

    if (dt) {
        if (await hasDtHeaderLintRule(joinPaths(dirPath, "tslint.json")) && isToplevelDtPath(dirPath)) {
            await critic(joinPaths(dirPath, "index.d.ts"));
        }
        await checkPackageJson(dirPath, typesVersions);
    }

    if (onlyTestTsNext) {
        if (typesVersions.length === 0) {
            await testTypesVersion(dirPath, "next", "next", isOlderVersion, dt, indexText, expectOnly);
        } else {
            const latestTypesVersion = last(typesVersions);
            const versionPath = joinPaths(dirPath, `ts${latestTypesVersion}`);
            const versionIndexText = await readFile(joinPaths(versionPath, "index.d.ts"), "utf-8");
            await testTypesVersion(
                versionPath, "next", "next",
                isOlderVersion, dt, versionIndexText, expectOnly, /*inTypesVersionDirectory*/ true);
        }
    } else {
        await testTypesVersion(dirPath, undefined, getTsVersion(0), isOlderVersion, dt, indexText, expectOnly);
        for (let i = 0; i < typesVersions.length; i++) {
            const version = typesVersions[i];
            const versionPath = joinPaths(dirPath, `ts${version}`);
            const versionIndexText = await readFile(joinPaths(versionPath, "index.d.ts"), "utf-8");
            await testTypesVersion(
                versionPath, version, getTsVersion(i + 1), isOlderVersion, dt, versionIndexText,
                expectOnly, /*inTypesVersionDirectory*/ true);
        }

        function getTsVersion(i: number): TsVersion {
            return i === typesVersions.length ? "next" : assertDefined(TypeScriptVersion.previous(typesVersions[i]));
        }
    }
}

function isToplevelDtPath(dirPath: string) {
    return basename(dirname(dirPath)) === "types" &&
        basename(dirname(dirname(dirPath))) === "DefinitelyTyped";

}

async function hasDtHeaderLintRule(tslintPath: string) {
    if (await pathExists(tslintPath)) {
        const tslint = await readJson(tslintPath);
        if (tslint.rules && tslint.rules["dt-header"] !== undefined) {
            return !!tslint.rules["dt-header"];
        }

        // if dt-header is not present, assume that tslint.json extends dtslint.json
        return true;
    }
    return false;
}

async function testTypesVersion(
    dirPath: string,
    lowVersion: TsVersion | undefined,
    maxVersion: TsVersion,
    isOlderVersion: boolean,
    dt: boolean,
    indexText: string,
    expectOnly: boolean,
    inTypesVersionDirectory?: boolean,
): Promise<void> {
    const minVersionFromComment = getTypeScriptVersionFromComment(indexText);
    if (minVersionFromComment !== undefined && inTypesVersionDirectory) {
        throw new Error(`Already in the \`ts${lowVersion}\` directory, don't need \`// TypeScript Version\`.`);
    }
    const minVersion = lowVersion || minVersionFromComment || TypeScriptVersion.lowest;

    await checkTslintJson(dirPath, dt);
    await checkTsconfig(dirPath, dt
        ? { relativeBaseUrl: ".." + (isOlderVersion ? "/.." : "") + (inTypesVersionDirectory ? "/.." : "") + "/" }
        : undefined);
    const err = await lint(dirPath, minVersion, maxVersion, !!inTypesVersionDirectory, expectOnly);
    if (err) {
        throw new Error(err);
    }
}

function assertPathIsInDefinitelyTyped(dirPath: string): void {
    const parent = dirname(dirPath);
    const types = /^v\d+$/.test(basename(dirPath)) ? dirname(parent) : parent;
    const dt = dirname(types);
    if (basename(dt) !== "DefinitelyTyped" || basename(types) !== "types") {
        throw new Error("Since this type definition includes a header (a comment starting with `// Type definitions for`), "
            + "assumed this was a DefinitelyTyped package.\n"
            + "But it is not in a `DefinitelyTyped/types/xxx` directory.");
    }
}

function getTypeScriptVersionFromComment(text: string): TypeScriptVersion | undefined {
    const searchString = "// TypeScript Version: ";
    const x = text.indexOf(searchString);
    if (x === -1) {
        return undefined;
    }

    let line = text.slice(x, text.indexOf("\n", x));
    if (line.endsWith("\r")) {
        line = line.slice(0, line.length - 1);
    }
    return parseTypeScriptVersionLine(line);
}

if (!module.parent) {
    main().catch(err => {
        console.error(err.stack);
        process.exit(1);
    });
}

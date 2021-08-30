import { makeTypesVersionsForPackageJson } from "@definitelytyped/header-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import assert = require("assert");
import { pathExists } from "fs-extra";
import { join as joinPaths } from "path";

import { readJsonWithComments } from "./readJsonWithComments";

export async function checkPackageJson(
    dirPath: string,
    typesVersions: readonly TypeScriptVersion[],
): Promise<void> {
    const pkgJsonPath = joinPaths(dirPath, "package.json");
    const needsTypesVersions = typesVersions.length !== 0;
    if (!await pathExists(pkgJsonPath)) {
        if (needsTypesVersions) {
            throw new Error(`${dirPath}: Must have 'package.json' for "typesVersions"`);
        }
        return;
    }

    const pkgJson = await readJsonWithComments(pkgJsonPath) as Record<string, unknown>;

    if ((pkgJson as any).private !== true) {
        throw new Error(`${pkgJsonPath} should set \`"private": true\``);
    }

    if (needsTypesVersions) {
        assert.strictEqual((pkgJson as any).types, "index", `"types" in '${pkgJsonPath}' should be "index".`);
        const expected = makeTypesVersionsForPackageJson(typesVersions);
        assert.deepEqual((pkgJson as any).typesVersions, expected,
            `"typesVersions" in '${pkgJsonPath}' is not set right. Should be: ${JSON.stringify(expected, undefined, 4)}`);
    }

    for (const key in pkgJson) { // tslint:disable-line forin
        switch (key) {
            case "private":
            case "dependencies":
            case "license":
                // "private"/"typesVersions"/"types" checked above, "dependencies" / "license" checked by types-publisher,
                break;
            case "typesVersions":
            case "types":
                if (!needsTypesVersions) {
                    throw new Error(`${pkgJsonPath} doesn't need to set "${key}" when no 'ts3.x' directories exist.`);
                }
                break;
            default:
                throw new Error(`${pkgJsonPath} should not include field ${key}`);
        }
    }
}

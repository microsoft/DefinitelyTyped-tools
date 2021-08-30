import { pathExists } from "fs-extra";
import { join } from "path";
import * as ts from "typescript";

import { readJsonWithComments } from "./readJsonWithComments";

export async function getCompilerOptions(dirPath: string): Promise<ts.CompilerOptions> {
    const tsconfigPath = join(dirPath, "tsconfig.json");
    if (!await pathExists(tsconfigPath)) {
        throw new Error(`Need a 'tsconfig.json' file in ${dirPath}`);
    }
    return (await readJsonWithComments(tsconfigPath)).compilerOptions;
}

import * as yargs from "yargs";

import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options, writeDataFile } from "./lib/common";
import { UncachedNpmInfoClient } from "./lib/npm-client";
import { AllPackages, TypingsData } from "./lib/packages";
import { loggerWithErrors } from "./util/logging";
import { logUncaughtErrors } from "./util/util";

if (!module.parent) {
    const log = loggerWithErrors()[0];
    const single = yargs.argv.single as string | undefined;
    if (single) {
        logUncaughtErrors(doSingle(single, new UncachedNpmInfoClient()));
    } else {
        logUncaughtErrors(
            async () => createSearchIndex(await AllPackages.read(await getDefinitelyTyped(Options.defaults, log)), new UncachedNpmInfoClient()));
    }
}

export interface SearchRecord {
    // types package name
    readonly t: string;
    // globals
    readonly g: ReadonlyArray<string>;
    // modules
    readonly m: ReadonlyArray<string>;
    // project name
    readonly p: string;
    // library name
    readonly l: string;
    // downloads in the last month from NPM
    readonly d: number;
}

export default async function createSearchIndex(packages: AllPackages, client: UncachedNpmInfoClient): Promise<void> {
    console.log("Generating search index...");
    const records = await createSearchRecords(packages.allLatestTypings(), client);
    console.log("Done generating search index. Writing out data files...");
    await writeDataFile("search-index-min.json", records, false);
}

async function doSingle(name: string, client: UncachedNpmInfoClient): Promise<void> {
    const pkg = await AllPackages.readSingle(name);
    const record = (await createSearchRecords([pkg], client))[0];
    console.log(record);
}

async function createSearchRecords(packages: ReadonlyArray<TypingsData>, client: UncachedNpmInfoClient): Promise<ReadonlyArray<SearchRecord>> {
    // TODO: Would like to just use pkg.unescapedName unconditionally, but npm doesn't allow scoped packages.
    const dl = await client.getDownloads(packages.map((pkg, i) => pkg.name === pkg.unescapedName ? pkg.name : `dummy${i}`));
    return packages.map((pkg, i): SearchRecord => ({
        p: pkg.projectName,
        l: pkg.libraryName,
        g: pkg.globals,
        t: pkg.name,
        m: pkg.declaredModules,
        d: dl[i],
    })).sort((a, b) => b.d - a.d);
}

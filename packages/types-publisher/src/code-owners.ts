import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options, TesterOptions } from "./lib/common";
import { AllPackages, TypingsData } from "./lib/packages";
import { typesDirectoryName } from "./lib/settings";
import { writeFile } from "./util/io";
import { loggerWithErrors } from "./util/logging";
import { joinPaths, logUncaughtErrors, mapDefined } from "./util/util";

if (!module.parent) {
    logUncaughtErrors(main(Options.defaults));
}

async function main(options: TesterOptions): Promise<void> {
    const log = loggerWithErrors()[0];
    const allPackages = await AllPackages.read(await getDefinitelyTyped(options, log));
    const typings = allPackages.allTypings();
    const maxPathLen = Math.max(...typings.map(t => t.subDirectoryPath.length));
    const lines = mapDefined(typings, t => getEntry(t, maxPathLen));
    const text = `${header}\n\n${lines.join("\n")}\n`;
    const path = joinPaths(options.definitelyTypedPath, ".github", "CODEOWNERS");
    await writeFile(path, text);
}

const header =
`# This file is generated.
# Add yourself to the "Definitions by:" list instead.
# See https://github.com/DefinitelyTyped/DefinitelyTyped#edit-an-existing-package`;

function getEntry(pkg: TypingsData, maxPathLen: number): string | undefined {
    const users = mapDefined(pkg.contributors, c => c.githubUsername);
    if (!users.length) {
        return undefined;
    }

    const path = `${pkg.subDirectoryPath}/`.padEnd(maxPathLen);
    return `/${typesDirectoryName}/${path} ${users.map(u => `@${u}`).join(" ")}`;
}

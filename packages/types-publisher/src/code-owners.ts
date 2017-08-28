import { Options } from "./lib/common";
import { AllPackages, TypingsData } from "./lib/packages";
import { typesDirectoryName } from "./lib/settings";
import { writeFile } from "./util/io";
import {  done, joinPaths, mapDefined } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

async function main(options: Options): Promise<void> {
	const allPackages = await AllPackages.read(options);
	const typings = allPackages.allTypings();
	const maxPathLen = Math.max(...typings.map(t => t.subDirectoryPath.length));
	const lines = mapDefined(typings, t => getEntry(t, maxPathLen));
	const text = `${lines.join("\n")}\n`;
	const path = joinPaths(options.definitelyTypedPath, ".github", "CODEOWNERS");
	await writeFile(path, text);
}

function getEntry(pkg: TypingsData, maxPathLen: number): string | undefined {
	const users = mapDefined(pkg.contributors, c => c.githubUsername);
	if (!users.length) {
		return undefined;
	}

	const path = `${pkg.subDirectoryPath}/`.padEnd(maxPathLen);
	return `/${typesDirectoryName}/${path} ${users.map(u => `@${u}`).join(" ")}`;
}

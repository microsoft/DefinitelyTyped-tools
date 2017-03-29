import { execSync } from "child_process";
import * as fsp from "fs-promise";
import { dirname } from "path";

import { Options } from "./lib/common";
import { sourceBranch, sourceRepository } from "./lib/settings";
import { done } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

export default async function main(options: Options): Promise<void> {
	const dtPath = options.definitelyTypedPath;

	if (await fsp.exists(options.definitelyTypedPath)) {
		console.log(`Fetching changes from ${sourceBranch}`);

		const actualBranch = exec(`git rev-parse --abbrev-ref HEAD`, dtPath);
		if (actualBranch !== sourceBranch) {
			throw new Error(`Please checkout branch '${sourceBranch}`);
		}

		const diff = exec(`git diff --name-only`, dtPath);
		if (diff) {
			throw new Error(`'git diff' should be empty. Following files changed:\n${diff}`);
		}

		exec(`git pull`, dtPath);
	}
	else {
		console.log(`Cloning ${sourceRepository} to ${dtPath}`);
		exec(`git clone ${sourceRepository}`, dirname(dtPath));
		exec(`git checkout ${sourceBranch}`, dtPath);
	}
}

function exec(cmd: string, cwd?: string): string {
	console.log(`Exec${cwd ? " at " + cwd : ""}: ${cmd}`);
	const result = execSync(cmd, { cwd, encoding: "utf8" }).trim();
	console.log(result);
	return result.trim();
}

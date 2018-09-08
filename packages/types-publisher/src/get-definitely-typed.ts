import { pathExists } from "fs-extra";
import { Clone, Ignore, Repository, Reset } from "nodegit";

import { Options } from "./lib/common";
import { sourceBranch, sourceRepository } from "./lib/settings";
import { done, filterNAtATime } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

export default async function main(options: Options): Promise<void> {
	const dtPath = options.definitelyTypedPath;

	if (await pathExists(options.definitelyTypedPath)) {
		const repo = await Repository.open(options.definitelyTypedPath);
		const actualBranch = (await repo.getCurrentBranch()).name();

		if (actualBranch !== `refs/heads/${sourceBranch}`) {
			throw new Error(`Please checkout branch '${sourceBranch}'`);
		}

		console.log(`Fetching changes from ${sourceBranch}`);

		if (options.resetDefinitelyTyped) {
			const headCommit = await repo.getHeadCommit();
			await Reset.reset(repo, headCommit as any, Reset.TYPE.HARD, undefined!);
		}

		await checkStatus(repo);
		await repo.fetch("origin");
		await repo.mergeBranches(sourceBranch, `origin/${sourceBranch}`, undefined!, undefined!);
	} else {
		console.log(`Cloning ${sourceRepository} to ${dtPath}`);
		const repo = await Clone.clone(sourceRepository, dtPath);
		await repo.checkoutBranch(sourceBranch);
	}
}

async function checkStatus(repo: Repository): Promise<void> {
	const statuses = await repo.getStatus();
	const changedFiles = await filterNAtATime(1, statuses.map(s => s.path()), async path => !(await Ignore.pathIsIgnored(repo, path)));
	if (changedFiles.length) {
		throw new Error(`The following files are dirty: ${changedFiles}`);
	}
}

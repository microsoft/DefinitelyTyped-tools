import * as fsp from "fs-promise";
import { Clone, Ignore, Repository } from "nodegit";

import { Options } from "./lib/common";
import { sourceBranch, sourceRepository } from "./lib/settings";
import { Logger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

export default async function main(options: Options): Promise<void> {
	const repo = await getRepo(options);
	await pull(repo, console.log);
	await checkStatus(repo);
}

async function getRepo(options: Options): Promise<Repository> {
	if (await fsp.exists(options.definitelyTypedPath)) {
		const repo = await Repository.open(options.definitelyTypedPath);
		const currentBranch = (await repo.getCurrentBranch()).name();
		const correctBranch = `refs/heads/${sourceBranch}`;
		if (currentBranch !== correctBranch) {
			throw new Error(`Need to checkout ${correctBranch}, currently on ${currentBranch}`);
		}
		return repo;
	}
	else {
		const repo = await Clone(sourceRepository, options.definitelyTypedPath);
		await repo.checkoutBranch(sourceBranch);
		return repo;
	}
}

async function pull(repo: Repository, log: Logger): Promise<void> {
	log(`Fetching changes from ${sourceBranch}`);
	await repo.fetchAll();
	log(`Merging changes`);
	await repo.mergeBranches(sourceBranch, `origin/${sourceBranch}`);
}

async function checkStatus(repo: Repository): Promise<void> {
	const statuses = await repo.getStatus();
	const changedFiles = statuses.map(s => s.path()).filter(path => !Ignore.pathIsIgnored(repo, path));
	if (changedFiles.length) {
		throw new Error(`The following files are dirty: ${changedFiles}`);
	}
}

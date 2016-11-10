import * as fsp from "fs-promise";
import { Clone, Ignore, Repository } from "nodegit";

import { Options, settings } from "./lib/common";
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
		const correctBranch = `refs/heads/${settings.sourceBranch}`;
		if (currentBranch !== correctBranch) {
			throw new Error(`Need to checkout ${correctBranch}, currently on ${currentBranch}`);
		}
		return repo;
	}
	else {
		const repo = await Clone(settings.sourceRepository, options.definitelyTypedPath);
		await repo.checkoutBranch(settings.sourceBranch);
		return repo;
	}
}

async function pull(repo: Repository, log: Logger): Promise<void> {
	log(`Pulling new changes from ${settings.sourceBranch}`);
	await repo.fetchAll();
	await repo.mergeBranches(settings.sourceBranch, `origin/${settings.sourceBranch}`);
}

async function checkStatus(repo: Repository): Promise<void> {
	const statuses = await repo.getStatus();
	const changedFiles = statuses.map(s => s.path()).filter(path => !Ignore.pathIsIgnored(repo, path));
	if (changedFiles.length) {
		throw new Error(`The following files are dirty: ${changedFiles}`);
	}
}

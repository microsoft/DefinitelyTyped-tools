import * as fsp from "fs-promise";
import { Clone, Ignore, Repository } from "nodegit";

import { settings } from "./lib/common";
import { done } from "./util/util";

if (!module.parent) {
	done(main());
}

export default async function main(): Promise<void> {
	const repo = await getRepo();
	await pull(repo);
	await checkStatus(repo);
}

async function getRepo(): Promise<Repository> {
	if (fsp.exists(settings.definitelyTypedPath)) {
		const repo = await Repository.open(settings.definitelyTypedPath);
		const currentBranch = (await repo.getCurrentBranch()).name();
		const correctBranch = `refs/heads/${settings.sourceBranch}`;
		if (currentBranch !== correctBranch) {
			throw new Error(`Need to checkout ${correctBranch}, currently on ${currentBranch}`);
		}
		return repo;
	}
	else {
		const repo = await Clone(settings.sourceRepository, settings.definitelyTypedPath);
		await repo.checkoutBranch(settings.sourceBranch);
		return repo;
	}
}

async function pull(repo: Repository): Promise<void> {
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

import * as assert from "assert";
import * as fsp from "fs-promise";
import * as path from "path";
import * as child_process from "child_process";
import { Logger, ArrayLog, settings, writeLog } from "./lib/common";
import { done } from "./lib/util";

if (!module.parent) {
	done(main());
}

export default async function main(): Promise<void> {
	const log = new ArrayLog();
	await cloneIfNeeded(log);
	await checkBranch(log);
	await pull(log);

	const {infos, errors} = log.result();
	assert(!errors.length);
	await writeLog("get-definitely-typed.md", infos);
}

async function cloneIfNeeded(log: Logger): Promise<void> {
	if (!fsp.exists(settings.definitelyTypedPath)) {
		log.info("Cloning");
		await runCmd(
			`git clone ${settings.sourceRepository}`,
			path.dirname(settings.definitelyTypedPath));
		assert(await fsp.exists(settings.definitelyTypedPath));
		await runCmd(`git checkout ${settings.sourceBranch}`, settings.definitelyTypedPath);
	}
}

async function checkBranch(log: Logger): Promise<void> {
	log.info(`Checking that branch is ${settings.sourceBranch}...`);
	const branch = (await runCmd("git rev-parse --abbrev-ref HEAD", settings.definitelyTypedPath)).trim();
	if (branch !== settings.sourceBranch) {
		throw new Error(`Must be on ${settings.sourceBranch}; currently on ${branch}`);
	}
}

async function pull(log: Logger): Promise<void> {
	log.info("Pulling...");
	await runCmd("git pull", settings.definitelyTypedPath);
}

function runCmd(cmd: string, cwd?: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const minute = 60 * 1000;
		const options = {
			cwd,
			timeout: 10 * minute,
			encoding: "utf8"
		};
		child_process.exec(cmd, options, (err, stdout, stderr) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(<string> <any> stdout);
			}
		});
	});
}

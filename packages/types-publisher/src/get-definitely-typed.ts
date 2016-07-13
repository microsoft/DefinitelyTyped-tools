import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { Logger, ArrayLog, settings, writeLogSync } from "./lib/common";

if (!module.parent) {
	main();
}

export default function main(): void {
	const log = new ArrayLog();
	cloneIfNeeded(log);
	checkBranch(log);
	pull(log);

	const {infos, errors} = log.result();
	assert(!errors.length);
	writeLogSync("get-definitely-typed.md", infos);
}

function cloneIfNeeded(log: Logger): void {
	if (!fs.existsSync(settings.definitelyTypedPath)) {
		log.info("Cloning");
		runCmd(
			`git clone ${settings.sourceRepository}`,
			path.dirname(settings.definitelyTypedPath));
		assert(fs.existsSync(settings.definitelyTypedPath));
		runCmd(`git checkout ${settings.sourceBranch}`, settings.definitelyTypedPath);
	}
}

function checkBranch(log: Logger): void {
	log.info(`Checking that branch is ${settings.sourceBranch}...`);
	const branch = runCmd("git rev-parse --abbrev-ref HEAD", settings.definitelyTypedPath).trim();
	if (branch !== settings.sourceBranch) {
		throw new Error(`Must be on ${settings.sourceBranch}; currently on ${branch}`);
	}
}

function pull(log: Logger): void {
	log.info("Pulling...");
	runCmd("git pull", settings.definitelyTypedPath);
}

function runCmd(cmd: string, cwd?: string): string {
	return <string> child_process.execSync(cmd, {
		cwd,
		timeout: 60 * 1000,
		encoding: "utf8"
	});
}

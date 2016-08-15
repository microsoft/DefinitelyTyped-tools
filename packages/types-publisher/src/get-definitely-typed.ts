import * as assert from "assert";
import * as fsp from "fs-promise";
import * as path from "path";
import * as child_process from "child_process";
import { settings } from "./lib/common";
import { loggerWithErrors, LoggerWithErrors, joinLogWithErrors, writeLog } from "./lib/logging";
import { done } from "./lib/util";

if (!module.parent) {
	done(main());
}

export default async function main(): Promise<void> {
	const [log, logResult] = loggerWithErrors();
	await cloneIfNeeded(log);
	await checkBranch(log);
	await pull(log);

	await writeLog("get-definitely-typed.md", joinLogWithErrors(logResult()));
}

async function cloneIfNeeded(log: LoggerWithErrors): Promise<void> {
	if (!fsp.exists(settings.definitelyTypedPath)) {
		await runCmd(
			`git clone ${settings.sourceRepository}`,
			path.dirname(settings.definitelyTypedPath),
			log);
		assert(await fsp.exists(settings.definitelyTypedPath));
		await runCmd(`git checkout ${settings.sourceBranch}`, settings.definitelyTypedPath, log);
	}
}

async function checkBranch(log: LoggerWithErrors): Promise<void> {
	log.info(`Checking that branch is ${settings.sourceBranch}...`);
	const branch = (await runCmd("git rev-parse --abbrev-ref HEAD", settings.definitelyTypedPath, log)).trim();
	if (branch !== settings.sourceBranch) {
		throw new Error(`Must be on ${settings.sourceBranch}; currently on ${branch}`);
	}
}

async function pull(log: LoggerWithErrors): Promise<void> {
	await runCmd("git pull", settings.definitelyTypedPath, log);
}

function runCmd(cmd: string, cwd: string, log: LoggerWithErrors): Promise<string> {
	log.info(`exec: ${cmd}`);
	return new Promise<string>((resolve, reject) => {
		const minute = 60 * 1000;
		const options = {
			cwd,
			timeout: 10 * minute,
			encoding: "utf8"
		};
		child_process.exec(cmd, options, (err, stdout, stderr) => {
			if (stdout) {
				log.info(`Response: ${stdout}`);
			}
			if (stderr) {
				log.error(`Error response: ${stderr}`);
			}

			if (err) {
				reject(err);
			}
			else {
				resolve(<string> <any> stdout);
			}
		});
	});
}

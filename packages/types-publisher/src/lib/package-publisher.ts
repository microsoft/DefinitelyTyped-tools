import assert = require("assert");
import { AnyPackage, fullPackageName, isNotNeededPackage, notNeededReadme, settings } from "./common";
import { consoleLogger, quietLogger, Log, LoggerWithErrors } from "./logging";
import { readJson } from "./util";
import * as path from "path";
import * as child_process from "child_process";
import NpmClient from "./npm-client";

export async function publishPackage(client: NpmClient, pkg: AnyPackage, dry: boolean): Promise<Log> {
	const [log, logResult] = quietLogger();

	const name = pkg.typingsPackageName;
	log(`Publishing ${name}`);

	const packageDir = path.join("output", name);
	const packageJson = await readJson(path.join(packageDir, "package.json"));
	const version = packageJson.version;
	assert(typeof version === "string");

	await client.publish(packageDir, packageJson, dry);
	if (settings.tag && settings.tag !== "latest" && !dry) { // "latest" is the default tag anyway
		await client.tag(name, version, settings.tag);
	}

	if (isNotNeededPackage(pkg)) {
		log(`Deprecating ${name}`);
		// Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
		const message = notNeededReadme(pkg, /*useNewline*/ false);
		if (!dry) {
			await client.deprecate(fullPackageName(name), version, message);
		}
	}

	return logResult();
}

// Used for testing only.
export async function unpublishPackage(pkg: AnyPackage, dry: boolean): Promise<void> {
	const name = fullPackageName(pkg.typingsPackageName);
	const args: string[] = ["npm", "unpublish", name, "--force"];
	await runCommand("Unpublish", consoleLogger, dry, args);
}

function runCommand(commandDescription: string, log: LoggerWithErrors, dry: boolean, args: string[]): Promise<void> {
	const cmd = args.join(" ");
	log.info(`Run ${cmd}`);
	if (!dry) {
		return new Promise<void>((resolve, reject) => {
			child_process.exec(cmd, { encoding: "utf8" }, (err, stdoutBuffer, stderrBuffer) => {
				// These are wrongly typed as Buffer.
				const stdout = <string> <any> stdoutBuffer;
				const stderr = <string> <any> stderrBuffer;
				if (err) {
					log.error(`${commandDescription} failed: ${JSON.stringify(err)}`);
					log.info(`${commandDescription} failed, refer to error log`);
					log.error(stderr);
					reject(new Error(stderr));
				}
				else {
					log.info("Ran successfully");
					log.info(stdout);
				}
				resolve();
			});
		});
	} else {
		log.info("(dry run)");
		return Promise.resolve();
	}
}

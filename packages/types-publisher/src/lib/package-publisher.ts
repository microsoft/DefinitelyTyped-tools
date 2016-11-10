import assert = require("assert");
import * as path from "path";

import { readJson } from "../util/io";
import { consoleLogger, quietLogger, Log, LoggerWithErrors } from "../util/logging";
import { exec } from "../util/util";

import { AnyPackage, fullPackageName, isNotNeededPackage, notNeededReadme, settings } from "./common";
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

async function runCommand(commandDescription: string, log: LoggerWithErrors, dry: boolean, args: string[]): Promise<void> {
	const cmd = args.join(" ");
	log.info(`Run ${cmd}`);
	if (!dry) {
		const { error, stdout, stderr } = await exec(cmd);
		if (error) {
			log.error(`${commandDescription} failed: ${JSON.stringify(error)}`);
			log.info(`${commandDescription} failed, refer to error log`);
			log.error(stderr);
			throw new Error(stderr);
		}
		else {
			log.info("Ran successfully");
			log.info(stdout);
		}

	} else {
		log.info("(dry run)");
		return Promise.resolve();
	}
}

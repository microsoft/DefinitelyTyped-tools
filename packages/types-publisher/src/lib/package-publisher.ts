import assert = require("assert");
import * as path from "path";

import { addNpmTagsForPackage } from "../npmTags";
import { readFileAndWarn } from "../lib/common";
import { consoleLogger, quietLogger, Log, LoggerWithErrors } from "../util/logging";
import { exec } from "../util/util";

import { AnyPackage } from "./packages";
import NpmClient from "./npm-client";

export async function publishPackage(client: NpmClient, pkg: AnyPackage, dry: boolean): Promise<Log> {
	const [log, logResult] = quietLogger();

	log(`Publishing ${pkg.typingsPackageName}`);

	const packageDir = pkg.outputDir();
	const packageJson = await readFileAndWarn("generate", path.join(packageDir, "package.json"));

	const version = packageJson.version;
	assert(typeof version === "string");

	await client.publish(packageDir, packageJson, dry);
	await addNpmTagsForPackage(pkg, version, client, log, dry);

	if (pkg.isNotNeeded()) {
		log(`Deprecating ${pkg.typingsPackageName}`);
		// Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
		const message = pkg.readme(/*useNewline*/ false);
		if (!dry) {
			await client.deprecate(pkg.fullName(), version, message);
		}
	}

	return logResult();
}

// Used for testing only.
export async function unpublishPackage(pkg: AnyPackage, dry: boolean): Promise<void> {
	const name = pkg.fullName();
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

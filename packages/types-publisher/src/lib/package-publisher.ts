import assert = require("assert");

import { readFileAndWarn } from "../lib/common";
import Versions from "../lib/versions";
import { addNpmTagsForPackage } from "../npmTags";
import { consoleLogger, Log, LoggerWithErrors, quietLogger } from "../util/logging";
import { exec, joinPaths } from "../util/util";

import NpmClient from "./npm-client";
import { AnyPackage } from "./packages";

export default async function publishPackage(
	client: NpmClient, pkg: AnyPackage, versions: Versions, latestVersion: AnyPackage, dry: boolean): Promise<Log> {
	assert(pkg.isLatest === (pkg === latestVersion));
	const [log, logResult] = quietLogger();

	log(`Publishing ${pkg.desc}`);

	const packageDir = pkg.outputDirectory;
	const packageJson = await readFileAndWarn("generate", joinPaths(packageDir, "package.json"));

	await client.publish(packageDir, packageJson, dry);

	const latestVersionString = versions.getVersion(latestVersion).versionString;

	// If this is an older version of the package, we still update tags for the *latest*.
	// NPM will update "latest" even if we are publishing an older version of a package (https://github.com/npm/npm/issues/6778),
	// so we must undo that by re-tagging latest.
	await addNpmTagsForPackage(latestVersion, versions, latestVersionString, client, log, dry);

	if (pkg.isNotNeeded()) {
		log(`Deprecating ${pkg.name}`);
		// Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
		const message = pkg.readme(/*useNewline*/ false);
		if (!dry) {
			await client.deprecate(pkg.fullNpmName, latestVersionString, message);
		}
	}

	return logResult();
}

// Used for testing only.
export async function unpublishPackage(pkg: AnyPackage, dry: boolean): Promise<void> {
	const args: string[] = ["npm", "unpublish", pkg.fullNpmName, "--force"];
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

import assert = require("assert");
import { AnyPackage, Logger, LogResult, ArrayLog, consoleLogger, fullPackageName, isNotNeededPackage, getOutputPath, notNeededReadme, settings } from "./common";
import { parseJson, readJson } from "./util";
import fetch = require("node-fetch");
import * as path from "path";
import * as child_process from "child_process";
import NpmClient from "./npm-client";

export async function publishPackage(client: NpmClient, pkg: AnyPackage, dry: boolean): Promise<LogResult> {
	const log = new ArrayLog();

	const name = pkg.typingsPackageName;
	log.info(`Publishing ${name}`);

	const packageDir = path.join("output", name);
	const packageJson = await readJson(path.join(packageDir, "package.json"));

	await client.publish(packageDir, packageJson, dry);
	if (settings.tag && settings.tag !== "latest") { // "latest" is the default tag anyway
		assert(packageJson.version);
		await client.tag(name, packageJson.version, settings.tag);
	}

	if (isNotNeededPackage(pkg)) {
		log.info(`Deprecating ${name}`);
		const message = notNeededReadme(pkg);
		if (!dry) {
			await client.deprecate(name, message);
		}
	}

	return log.result();
}

// Used for testing only.
export async function unpublishPackage(pkg: AnyPackage, dry: boolean): Promise<void> {
	const name = fullPackageName(pkg.typingsPackageName);
	const args: string[] = ["npm", "unpublish", name, "--force"];
	await runCommand("Unpublish", consoleLogger, dry, args);
}

export async function shouldPublish(pkg: AnyPackage): Promise<[boolean, LogResult]> {
	const log = new ArrayLog();

	const outputPath = getOutputPath(pkg);
	// Read package.json for version number we would be publishing
	const packageJson = await readJson(path.join(outputPath, "package.json"));
	const localVersion: string = packageJson.version;
	log.info(`Local version from package.json is ${localVersion}`);

	// Hit e.g. http://registry.npmjs.org/@ryancavanaugh%2fjquery for version data
	const fullName = fullPackageName(pkg.typingsPackageName);
	const registryUrl = `https://registry.npmjs.org/${fullName.replace("/", "%2F")}`;
	log.info(`Fetch registry data from ${registryUrl}`);

	// See if this version already exists

	let bodyString: string;
	try {
		bodyString = await (await fetch(registryUrl)).text();
	} catch (err) {
		log.error(JSON.stringify(err));
		return [false, log.result()];
	}

	interface NpmRegistryResult {
		versions: {
			[key: string]: {};
		};
		error: string;
	}

	const body: NpmRegistryResult = parseJson(bodyString);

	return [shouldPublish(), log.result()];
	function shouldPublish() {
		if (body.error === "Not found") {
			// OK, just haven't published this one before
			log.info("Registry indicates this is a new package");
			return true;
		}
		else if (body.error) {
			// Critical failure
			log.info("Unexpected response, refer to error log");
			log.error(`NPM registry failure for ${registryUrl}: Unexpected error content ${body.error})`);
			return false;
		}
		else {
			const remoteVersionExists = body.versions && body.versions[localVersion] !== undefined;
			log.info(remoteVersionExists ? "Remote version already exists" : "Remote version does not exist");
			return !remoteVersionExists;
		}
	}
}

// Returns whether the command succeeded.
function runCommand(commandDescription: string, log: Logger, dry: boolean, args: string[]): Promise<boolean> {
	const cmd = args.join(" ");
	log.info(`Run ${cmd}`);
	if (!dry) {
		return new Promise<boolean>((resolve, reject) => {
			child_process.exec(cmd, { encoding: "utf8" }, (err, stdoutBuffer, stderrBuffer) => {
				// These are wrongly typed as Buffer.
				const stdout = <string> <any> stdoutBuffer;
				const stderr = <string> <any> stderrBuffer;
				if (err) {
					log.error(`${commandDescription} failed: ${JSON.stringify(err)}`);
					log.info(`${commandDescription} failed, refer to error log`);
					log.error(stderr);
					resolve(false);
				}
				else {
					log.info("Ran successfully");
					log.info(stdout);
					resolve(true);
				}
			});
		});
	} else {
		log.info("(dry run)");
	}
}

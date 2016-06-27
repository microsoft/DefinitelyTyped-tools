import { AnyPackage, Log, fullPackageName, isNotNeededPackage, getOutputPath, notNeededReadme, settings } from "./common";
import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as request from "request";

export function publishPackage(pkg: AnyPackage, dry: boolean, done: (log: Log) => void) {
	const {libraryName, typingsPackageName} = pkg;
	const log = new Log();

	const outputPath = getOutputPath(pkg);

	log.info(`Possibly publishing ${libraryName}`);

	// Read package.json for version number we would be publishing
	const localVersion: string = JSON.parse(fs.readFileSync(path.join(outputPath, "package.json"), "utf-8")).version;
	log.info(`Local version from package.json is ${localVersion}`);

	shouldUpdateNpmPackage(log, pkg, localVersion, shouldUpdate => {
		if (shouldUpdate) {
			const args: string[] = ["npm", "publish", path.resolve(outputPath), "--access public"];
			if (settings.tag) {
				args.push(`--tag ${settings.tag}`);
			}

			if (runCommand("Publish", log, dry, args)) {
				if (isNotNeededPackage(pkg)) {
					const message = notNeededReadme(pkg);
					const args = ["npm", "deprecate", fullPackageName(typingsPackageName), JSON.stringify(message)];
					runCommand("Deprecate", log, dry, args);
				}
			}
		}

		done(log);
	});
}

function runCommand(commandDescription: string, log: Log, dry: boolean, args: string[]): boolean {
	const cmd = args.join(" ");
	log.info(`Run ${cmd}`);
	if (!dry) {
		try {
			const result = <string> child_process.execSync(cmd, { encoding: "utf-8" });
			log.info(`Ran successfully`);
			log.info(result);
			return true;
		}
		catch (e) {
			log.error(`${commandDescription} failed: ${JSON.stringify(e)}`);
			log.info(`${commandDescription} failed, refer to error log`);
			return false;
		}
	} else {
		log.info("(dry run)");
		return true;
	}
}

function shouldUpdateNpmPackage(log: Log, {typingsPackageName}: AnyPackage, localVersion: string, callback: (shouldUpdate: boolean) => void): void {
	// Hit e.g. http://registry.npmjs.org/@ryancavanaugh%2fjquery for version data
	const registryUrl = `http://registry.npmjs.org/@${settings.scopeName}%2F${typingsPackageName}`;
	log.info(`Fetch registry data from ${registryUrl}`);

	// See if this version already exists
	request.get(registryUrl, (err: any, resp: any, bodyString: string) => {
		if (err) {
			log.error(JSON.stringify(err));
			callback(false);
			return;
		}

		const body: NpmRegistryResult = JSON.parse(bodyString);
		callback(shouldUpdate(body));
	});

	interface NpmRegistryResult {
		versions: {
			[key: string]: {};
		};
		error: string;
	}

	function shouldUpdate(body: NpmRegistryResult): boolean {
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
			const remoteVersionExists = body.versions[localVersion] !== undefined;
			log.info(remoteVersionExists ? "Remote version already exists" : "Remote version does not exist");
			return !remoteVersionExists;
		}
	}
}

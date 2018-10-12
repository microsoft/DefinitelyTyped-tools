import { TypeScriptVersion } from "definitelytyped-header-parser";
import * as yargs from "yargs";

import { NpmPublishClient } from "./lib/npm-client";
import { AllPackages, AnyPackage } from "./lib/packages";
import Versions from "./lib/versions";

import { consoleLogger, Logger } from "./util/logging";
import { done, nAtATime } from "./util/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	done(tagAll(dry));
}

/**
 * Refreshes the tags on every package.
 * This shouldn't normally need to run, since we run `tagSingle` whenever we publish a package.
 * But this should be run if the way we calculate tags changes (e.g. when a new release is allowed to be tagged "latest").
 */
async function tagAll(dry: boolean): Promise<void> {
	const versions = await Versions.load();
	const client = await NpmPublishClient.create();

	await nAtATime(10, await AllPackages.readTypings(), async pkg => {
		// Only update tags for the latest version of the package.
		if (pkg.isLatest) {
			const version = versions.getVersion(pkg).versionString;
			await updateTypeScriptVersionTags(pkg, version, client, consoleLogger.info, dry);
			await updateLatestTag(pkg, versions, client, consoleLogger.info, dry);
		}
	});

	// Don't tag notNeeded packages
}

export async function updateTypeScriptVersionTags(pkg: AnyPackage, version: string, client: NpmPublishClient, log: Logger, dry: boolean
	): Promise<void> {
	const tags = TypeScriptVersion.tagsToUpdate(pkg.minTypeScriptVersion);
	log(`Tag ${pkg.fullNpmName}@${version} as ${JSON.stringify(tags)}`);
	if (!dry) {
		for (const tagName of tags) {
			await tag(version, tagName, client, pkg);
		}
	}
}

export async function updateLatestTag(pkg: AnyPackage, versions: Versions, client: NpmPublishClient, log: Logger, dry: boolean): Promise<void> {
	// Prerelease packages should never be tagged latest
	const latestNonPrerelease = versions.latestNonPrerelease(pkg);
	log(`	but tag ${pkg.fullNpmName}@${latestNonPrerelease.versionString} as "latest"`);
	if (!dry) {
		await tag(latestNonPrerelease.versionString, "latest", client, pkg);
	}
}

function tag(versionString: string, tag: string, client: NpmPublishClient, pkg: AnyPackage): Promise<void> {
	return client.tag(pkg.fullEscapedNpmName, versionString, tag);
}

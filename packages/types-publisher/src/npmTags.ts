import { TypeScriptVersion } from "definitelytyped-header-parser";
import * as yargs from "yargs";

import NpmClient from "./lib/npm-client";
import { AllPackages, AnyPackage } from "./lib/packages";
import Versions from "./lib/versions";

import { Logger } from "./util/logging";
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
async function tagAll(dry: boolean) {
	const versions = await Versions.load();
	const client = await NpmClient.create();

	await nAtATime(10, await AllPackages.readTypings(), async pkg => {
		// Only update tags for the latest version of the package.
		if (pkg.isLatest) {
			const version = versions.getVersion(pkg).versionString;
			await addNpmTagsForPackage(pkg, versions, version, client, console.log, dry);
		}
	});

	// Don't tag notNeeded packages
}

export async function addNpmTagsForPackage(pkg: AnyPackage, versions: Versions, version: string, client: NpmClient, log: Logger, dry: boolean
	): Promise<void> {
	const tags = TypeScriptVersion.tagsToUpdate(pkg.typeScriptVersion);
	log(`Tag ${pkg.fullNpmName}@${version} as ${JSON.stringify(tags)}`);
	if (!dry) {
		for (const tag of tags) {
			await client.tag(pkg.fullEscapedNpmName, version, tag);
		}
	}

	// Prerelease packages should never be tagged latest
	const latestNonPrerelease = versions.latestNonPrerelease(pkg);
	if (latestNonPrerelease) {
		log(`	but tag ${pkg.fullNpmName}@${latestNonPrerelease.versionString} as "latest"`);
		if (!dry) {
			await tag(latestNonPrerelease.versionString, "latest");
		}
	}

	async function tag(versionString: string, tag: string) {
		await client.tag(pkg.fullEscapedNpmName, versionString, tag);
	}
}

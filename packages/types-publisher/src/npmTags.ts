import * as yargs from "yargs";

import { AnyPackage, TypeScriptVersion, existsTypesDataFileSync, fullPackageName, readTypings } from "./lib/common";
import NpmClient from "./lib/npm-client";
import Versions, { versionString } from "./lib/versions";

import { Logger } from "./util/logging";
import { done } from "./util/util";

if (!module.parent) {
	if (!existsTypesDataFileSync()) {
		console.log("Run parse-definitions first!");
	}
	else if (!Versions.existsSync()) {
		console.log("Run calculate-versions first!");
	}
	else {
		const dry = !!yargs.argv.dry;
		done(tagAll(dry));
	}
}

/**
 * Refreshes the tags on every package.
 * This shouldn't normally need to run, since we run `tagSingle` whenever we publish a package.
 * But this should be run if the way we calculate tags changes (e.g. when a new release is allowed to be tagged "latest").
 */
async function tagAll(dry: boolean) {
	const versions = await Versions.load();
	const client = await NpmClient.create();

	for (const t of await readTypings()) {
		const version = versionString(versions.versionInfo(t).version);
		await addNpmTagsForPackage(t, version, client, console.log, dry);
	}

	// Don't tag notNeeded packages
}

export async function addNpmTagsForPackage(pkg: AnyPackage, version: string, client: NpmClient, log: Logger, dry: boolean): Promise<void> {
	const tags = TypeScriptVersion.tagsToUpdate(pkg.packageKind === "not-needed" ? "2.0" : pkg.typeScriptVersion);
	log(`Tag ${fullPackageName(pkg.typingsPackageName)}@${version} as ${JSON.stringify(tags)}`);
	if (!dry) {
		for (const tag of tags) {
			await client.tag(fullPackageName(pkg.typingsPackageName), version, tag);
		}
	}
}

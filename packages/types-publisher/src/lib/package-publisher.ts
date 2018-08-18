import assert = require("assert");

import { readFileAndWarn } from "../lib/common";
import Versions from "../lib/versions";
import { updateLatestTag, updateTypeScriptVersionTags } from "../npmTags";
import { Log, quietLogger } from "../util/logging";
import { joinPaths } from "../util/util";

import NpmClient from "./npm-client";
import { AnyPackage, NotNeededPackage } from "./packages";

export default async function publishPackage(
	client: NpmClient,
	pkg: AnyPackage,
	allPackagesBeingPublished: ReadonlyArray<AnyPackage>,
	versions: Versions,
	latestVersion: AnyPackage,
	dry: boolean,
): Promise<Log> {
	assert(pkg.isLatest === (pkg === latestVersion));
	const [log, logResult] = quietLogger();

	log(`Publishing ${pkg.desc}`);

	const packageDir = pkg.outputDirectory;
	const packageJson = await readFileAndWarn("generate", joinPaths(packageDir, "package.json"));

	await client.publish(packageDir, packageJson, dry);

	const latestVersionString = versions.getVersion(latestVersion).versionString;

	if (pkg.isLatest) {
		await updateTypeScriptVersionTags(latestVersion, latestVersionString, client, log, dry);
	}
	if (pkg.isLatest || !allPackagesBeingPublished.includes(latestVersion)) {
		// If this is an older version of the package, we still update tags for the *latest*.
		// NPM will update "latest" even if we are publishing an older version of a package (https://github.com/npm/npm/issues/6778),
		// so we must undo that by re-tagging latest.
		await updateLatestTag(latestVersion, versions, client, log, dry);
	}

	if (pkg.isNotNeeded()) {
		log(`Deprecating ${pkg.name}`);
		assert(latestVersionString === pkg.version.versionString);
		// Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
		await deprecateNotNeededPackage(client, pkg, dry);
	}

	return logResult();
}

export async function deprecateNotNeededPackage(client: NpmClient, pkg: NotNeededPackage, dry = false): Promise<void> {
	// Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
	const message = pkg.readme(/*useNewline*/ false);
	if (!dry) {
		await client.deprecate(pkg.fullNpmName, pkg.version.versionString, message);
	}
}

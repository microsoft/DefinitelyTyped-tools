import { TypeScriptVersion } from "definitelytyped-header-parser";
import * as yargs from "yargs";

import { CachedNpmInfoClient, NpmPublishClient, UncachedNpmInfoClient } from "./lib/npm-client";
import { AllPackages, AnyPackage } from "./lib/packages";
import { getLatestTypingVersion } from "./lib/versions";

import { consoleLogger, Logger } from "./util/logging";
import { logUncaughtErrors, nAtATime } from "./util/util";

if (!module.parent) {
    const dry = !!yargs.argv.dry;
    logUncaughtErrors(tag(dry, yargs.argv.name as string | undefined));
}

/**
 * Refreshes the tags on every package.
 * This shouldn't normally need to run, since we run `tagSingle` whenever we publish a package.
 * But this should be run if the way we calculate tags changes (e.g. when a new release is allowed to be tagged "latest").
 */
async function tag(dry: boolean, name?: string): Promise<void> {
    const publishClient = await NpmPublishClient.create();
    await CachedNpmInfoClient.with(new UncachedNpmInfoClient(),  async infoClient => {
        if (name) {
            const pkgs = await AllPackages.readLatestTypings();
            const pkg = pkgs.find(pkg => pkg.fullNpmName === "@types/" + name)
            if (!pkg) {
                throw new Error(`couldn't find ${name}; ${pkgs[0].fullNpmName}`);
            }
            const version = await getLatestTypingVersion(pkg, infoClient);
            await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
            await updateLatestTag(pkg.fullEscapedNpmName, version, publishClient, consoleLogger.info, dry);
        }
        else {
            await nAtATime(10, await AllPackages.readLatestTypings(), async pkg => {
                // Only update tags for the latest version of the package.
                const version = await getLatestTypingVersion(pkg, infoClient);
                await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
                await updateLatestTag(pkg.fullEscapedNpmName, version, publishClient, consoleLogger.info, dry);
            });
        }
    });
    // Don't tag notNeeded packages
}

export async function updateTypeScriptVersionTags(
    pkg: AnyPackage, version: string, client: NpmPublishClient, log: Logger, dry: boolean,
): Promise<void> {
    const tags = TypeScriptVersion.tagsToUpdate(pkg.minTypeScriptVersion);
    log(`Tag ${pkg.fullNpmName}@${version} as ${JSON.stringify(tags)}`);
    if (!dry) {
        for (const tagName of tags) {
            await client.tag(pkg.fullEscapedNpmName, version, tagName);
        }
    }
}

export async function updateLatestTag(
    fullEscapedNpmName: string, version: string, client: NpmPublishClient, log: Logger, dry: boolean): Promise<void> {
    log(`   but tag ${fullEscapedNpmName}@${version} as "latest"`);
    if (!dry) {
        await client.tag(fullEscapedNpmName, version, "latest");
    }
}

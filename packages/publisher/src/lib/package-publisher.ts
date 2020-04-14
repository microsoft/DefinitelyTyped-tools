import assert = require("assert");
import { Logger, joinPaths, readFileAndWarn, NpmPublishClient, Registry } from "@definitelytyped/utils";
import { NotNeededPackage, AnyPackage } from "@definitelytyped/definitions-parser";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { ChangedTyping } from "./versions";
import { outputDirectory } from "../util/util";

export async function publishTypingsPackage(
  client: NpmPublishClient,
  changedTyping: ChangedTyping,
  dry: boolean,
  log: Logger,
  registry: Registry
): Promise<void> {
  const { pkg, version, latestVersion } = changedTyping;
  await common(client, pkg, log, dry, registry);
  if (pkg.isLatest) {
    await updateTypeScriptVersionTags(pkg, version, client, log, dry);
  }
  assert((latestVersion === undefined) === pkg.isLatest);
  if (latestVersion !== undefined) {
    // If this is an older version of the package, we still update tags for the *latest*.
    // NPM will update "latest" even if we are publishing an older version of a package (https://github.com/npm/npm/issues/6778),
    // so we must undo that by re-tagging latest.
    await updateLatestTag(pkg.fullNpmName, latestVersion, client, log, dry);
  }
}

export async function publishNotNeededPackage(
  client: NpmPublishClient,
  pkg: NotNeededPackage,
  dry: boolean,
  log: Logger,
  registry: Registry
): Promise<void> {
  log(`Deprecating ${pkg.name}`);
  await common(client, pkg, log, dry, registry);
  // Don't use a newline in the deprecation message because it will be displayed as "\n" and not as a newline.
  await deprecateNotNeededPackage(client, pkg, dry, log);
}

async function common(
  client: NpmPublishClient,
  pkg: AnyPackage,
  log: Logger,
  dry: boolean,
  registry: Registry
): Promise<void> {
  const packageDir = outputDirectory(pkg);
  const packageJson = await readFileAndWarn(
    "generate",
    joinPaths(packageDir + (registry === Registry.Github ? "-github" : ""), "package.json")
  );
  await client.publish(packageDir, packageJson, dry, log);
}

export async function deprecateNotNeededPackage(
  client: NpmPublishClient,
  pkg: NotNeededPackage,
  dry = false,
  log: Logger
): Promise<void> {
  const name = pkg.fullNpmName;
  if (dry) {
    log("(dry) Skip deprecate not needed package " + name + " at " + pkg.version.versionString);
  } else {
    log(`Deprecating ${name} at ${pkg.version.versionString} with message: ${pkg.deprecatedMessage()}.`);
    await client.deprecate(name, pkg.version.versionString, pkg.deprecatedMessage());
  }
}

export async function updateTypeScriptVersionTags(
  pkg: AnyPackage,
  version: string,
  client: NpmPublishClient,
  log: Logger,
  dry: boolean
): Promise<void> {
  const tags = TypeScriptVersion.tagsToUpdate(pkg.minTypeScriptVersion);
  const name = pkg.fullNpmName;
  log(`Tag ${name}@${version} as ${JSON.stringify(tags)}`);
  if (dry) {
    log("(dry) Skip tag");
  } else {
    for (const tagName of tags) {
      await client.tag(name, version, tagName, dry, log);
    }
  }
}

export async function updateLatestTag(
  fullName: string,
  version: string,
  client: NpmPublishClient,
  log: Logger,
  dry: boolean
): Promise<void> {
  log(`   but tag ${fullName}@${version} as "latest"`);
  if (dry) {
    log('   (dry) Skip move "latest" back to newest version');
  } else {
    await client.tag(fullName, version, "latest", dry, log);
  }
}

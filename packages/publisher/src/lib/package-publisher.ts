import assert = require("assert");
import { Logger, joinPaths, readFileAndWarn, NpmPublishClient } from "@definitelytyped/utils";
import { NotNeededPackage, AnyPackage } from "@definitelytyped/definitions-parser";
import { updateTypeScriptVersionTags, updateLatestTag } from "@definitelytyped/retag";
import { ChangedTyping } from "./versions";
import { outputDirectory } from "../util/util";

const temporaryTag = "old-version";

export async function publishTypingsPackage(
  client: Pick<NpmPublishClient, "publish" | "untag" | "tag">,
  changedTyping: ChangedTyping,
  dry: boolean,
  log: Logger,
  packageDir = outputDirectory(changedTyping.pkg),
): Promise<void> {
  const { pkg, version, latestVersion } = changedTyping;
  await common(client, pkg, log, dry, packageDir);
  if (pkg.isLatest) {
    await updateTypeScriptVersionTags(pkg, version, client, log, dry);
  }
  assert((latestVersion === undefined) === pkg.isLatest);
  if (latestVersion !== undefined) {
    // Ensure the latest tag is correct even though older versions are published under a temporary tag.
    await updateLatestTag(pkg.name, latestVersion, client, log, dry);
  }
}

export async function publishNotNeededPackage(
  client: Pick<NpmPublishClient, "publish" | "untag">,
  pkg: NotNeededPackage,
  dry: boolean,
  log: Logger,
): Promise<void> {
  log(`Deprecating ${pkg.name}`);
  await common(client, pkg, log, dry);
}

async function common(
  client: Pick<NpmPublishClient, "publish" | "untag">,
  pkg: AnyPackage,
  log: Logger,
  dry: boolean,
  packageDir = outputDirectory(pkg),
): Promise<void> {
  const packageJson = await readFileAndWarn("generate", joinPaths(packageDir, "package.json"));
  if (pkg.isLatest) {
    await client.publish(packageDir, packageJson, "latest", dry, log);
  } else {
    await client.publish(packageDir, packageJson, temporaryTag, dry, log);
    try {
      await client.untag(pkg.name, temporaryTag, dry, log);
    } catch (error) {
      log(`Failed to remove temporary tag for ${pkg.name}: ${error}`);
    }
  }
}

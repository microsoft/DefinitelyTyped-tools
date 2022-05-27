import { Logger, NpmPublishClient } from "@definitelytyped/utils";
import { NotNeededPackage, AnyPackage } from "@definitelytyped/definitions-parser";
import { updateTypeScriptVersionTags } from "@definitelytyped/retag";
import * as libpub from "libnpmpublish";
import * as pacote from "pacote";
import { ChangedTyping } from "./versions";
import { outputDirectory } from "../util/util";

// https://github.com/npm/types/pull/18
declare module "libnpmpublish" {
  function publish(
    manifest: Omit<import("@npm/types").PackageJson, "bundledDependencies">,
    tarData: Buffer,
    opts?: import("npm-registry-fetch").Options
  ): Promise<Response>;
}

export async function publishTypingsPackage(
  client: NpmPublishClient,
  changedTyping: ChangedTyping,
  token: string,
  dry: boolean,
  log: Logger
): Promise<void> {
  const { pkg, version } = changedTyping;
  await common(pkg, token, dry);
  if (pkg.isLatest) {
    await updateTypeScriptVersionTags(pkg, version, client, log, dry);
  }
}

export async function publishNotNeededPackage(
  pkg: NotNeededPackage,
  token: string,
  dry: boolean,
  log: Logger
): Promise<void> {
  log(`Deprecating ${pkg.name}`);
  await common(pkg, token, dry);
}

async function common(pkg: AnyPackage, token: string, dry: boolean): Promise<void> {
  const packageDir = outputDirectory(pkg);
  const manifest = await pacote.manifest(packageDir).catch((reason) => {
    throw reason.code === "ENOENT" ? new Error("Run generate first!", { cause: reason }) : reason;
  });
  const tarData = await pacote.tarball(packageDir);
  // Make sure we never assign the latest tag to an old version.
  if (!dry)
    await libpub.publish(manifest, tarData, { defaultTag: pkg.isLatest ? "latest" : "", access: "public", token });
}

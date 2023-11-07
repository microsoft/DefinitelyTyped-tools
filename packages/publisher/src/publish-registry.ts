import assert = require("assert");
import process from "process";
import fs from "fs";
import * as yargs from "yargs";

import { defaultLocalOptions, defaultRemoteOptions } from "./lib/common";
import { outputDirPath, validateOutputPath } from "./lib/settings";
import {
  getDefinitelyTyped,
  AllPackages,
  readNotNeededPackages,
  NotNeededPackage,
  TypingsData,
} from "@definitelytyped/definitions-parser";
import {
  computeHash,
  execAndThrowErrors,
  joinPaths,
  logUncaughtErrors,
  loggerWithErrors,
  FS,
  logger,
  writeLog,
  writeJson,
  writeFile,
  Logger,
  sleep,
  readJson,
  NpmPublishClient,
  cacheDir,
  isObject,
} from "@definitelytyped/utils";
import * as pacote from "pacote";
import * as semver from "semver";
// @ts-ignore
import pkg from "../package.json";

const typesRegistry = "types-registry";
const registryOutputPath = joinPaths(outputDirPath, typesRegistry);
const readme = `This package contains a listing of all packages published to the @types scope on NPM.
Generated by [types-publisher](${pkg.homepage}).`;

if (require.main === module) {
  const dry = !!yargs.argv.dry;
  logUncaughtErrors(async () => {
    const dt = await getDefinitelyTyped(
      process.env.GITHUB_ACTIONS ? defaultRemoteOptions : defaultLocalOptions,
      loggerWithErrors()[0]
    );
    await publishRegistry(dt, AllPackages.fromFS(dt), dry);
  });
}

export default async function publishRegistry(dt: FS, allPackages: AllPackages, dry: boolean): Promise<void> {
  const [log, logResult] = logger();
  log("=== Publishing types-registry ===");

  const { latestVersion, maxVersion, latestContentHash } = await fetchAndProcessNpmInfo(typesRegistry);
  assert(semver.satisfies(latestVersion, "~0.1"));

  // Don't include not-needed packages in the registry.
  const registryJsonData = await generateRegistry(await allPackages.allLatestTypings());
  const registry = JSON.stringify(registryJsonData);
  const newContentHash = computeHash(registry);
  const newVersion = semver.inc(latestVersion, "patch")!;

  await publishToRegistry();
  await writeLog("publish-registry.md", logResult());

  async function publishToRegistry() {
    const packageJson = generatePackageJson(typesRegistry, newVersion, newContentHash);
    await generate(registry, packageJson);

    const token = process.env.NPM_TOKEN!;

    const publishClient = () => NpmPublishClient.create(token, { defaultTag: "next" });
    if (maxVersion !== latestVersion) {
      // There was an error in the last publish and types-registry wasn't validated.
      // This may have just been due to a timeout, so test if types-registry@next is a subset of the one we're about to publish.
      // If so, we should just update it to "latest" now.
      log("Old version of types-registry was never tagged latest, so updating");
      await validateIsSubset(readNotNeededPackages(dt), log);
      await (await publishClient()).tag(typesRegistry, maxVersion, "latest", dry, log);
    } else if (latestContentHash !== newContentHash) {
      log("New packages have been added, so publishing a new registry.");
      await publish(await publishClient(), typesRegistry, packageJson, newVersion, dry, log);
    } else {
      log("No new packages published, so no need to publish new registry.");
      // Just making sure...
      await validate(log);
    }
  }
}

async function generate(registry: string, packageJson: {}): Promise<void> {
  await fs.promises.rm(registryOutputPath, { recursive: true, force: true });
  await fs.promises.mkdir(registryOutputPath, { recursive: true });
  await writeOutputJson("package.json", packageJson);
  await writeOutputFile("index.json", registry);
  await writeOutputFile("README.md", readme);

  function writeOutputJson(filename: string, content: object): Promise<void> {
    return writeJson(outputPath(filename), content);
  }

  function writeOutputFile(filename: string, content: string): Promise<void> {
    return writeFile(outputPath(filename), content);
  }

  function outputPath(filename: string): string {
    return joinPaths(registryOutputPath, filename);
  }
}

async function publish(
  client: NpmPublishClient,
  packageName: string,
  packageJson: {},
  version: string,
  dry: boolean,
  log: Logger
): Promise<void> {
  await client.publish(registryOutputPath, packageJson, dry, log);
  // Sleep for 60 seconds to let NPM update.
  if (dry) {
    log("(dry) Skipping 60 second sleep...");
  } else {
    log("Sleeping for 60 seconds ...");
    await sleep(60);
  }
  // Don't set it as "latest" until *after* it's been validated.
  await validate(log);
  await client.tag(packageName, version, "latest", dry, log);
}

async function installForValidate(log: Logger): Promise<void> {
  await fs.promises.rm(validateOutputPath, { recursive: true, force: true });
  await fs.promises.mkdir(validateOutputPath, { recursive: true });
  await writeJson(joinPaths(validateOutputPath, "package.json"), {
    name: "validate",
    version: "0.0.0",
    description: "description",
    readme: "",
    license: "",
    repository: {},
  });

  const cmd = `npm install types-registry@next`;
  log(cmd);
  const err = (
    await execAndThrowErrors(cmd, validateOutputPath, { ...process.env, COREPACK_ENABLE_STRICT: "0" })
  ).trim();
  if (err) {
    console.error(err);
  }
}

const validateTypesRegistryPath = joinPaths(validateOutputPath, "node_modules", "types-registry");

async function validate(log: Logger): Promise<void> {
  await installForValidate(log);
  const output = joinPaths(registryOutputPath, "index.json");
  const nodeModules = joinPaths(validateTypesRegistryPath, "index.json");
  log(`Checking that ${output} is newer than ${nodeModules}`);
  assertJsonNewer(await readJson(output, isObject), await readJson(nodeModules, isObject), log);
}

async function validateIsSubset(notNeeded: readonly NotNeededPackage[], log: Logger): Promise<void> {
  await installForValidate(log);
  const indexJson = "index.json";
  const actual = (await readJson(joinPaths(validateTypesRegistryPath, indexJson))) as Registry;
  const expected = (await readJson(joinPaths(registryOutputPath, indexJson))) as Registry;
  for (const key of Object.keys(actual.entries)) {
    if (!(key in expected.entries) && !notNeeded.some((p) => p.typesDirectoryName === key)) {
      throw new Error(`Actual types-registry has unexpected key ${key}`);
    }
  }
}

function assertJsonNewer(newer: { [s: string]: any }, older: { [s: string]: any }, log: Logger, parent = "") {
  for (const key of Object.keys(older)) {
    if (!newer.hasOwnProperty(key)) {
      log(`${key} in ${parent} was not found in newer -- assumed to be deprecated.`);
      continue;
    }
    switch (typeof newer[key]) {
      case "string":
        const newerver = semver.parse(newer[key]);
        const olderver = semver.parse(older[key]);
        const condition = newerver && olderver ? semver.gte(newerver, olderver) : newer[key] >= older[key];
        assert(condition, `${key} in ${parent} did not match: newer[key] (${newer[key]}) < older[key] (${older[key]})`);
        break;
      case "number":
        assert(
          newer[key] >= older[key],
          `${key} in ${parent} did not match: newer[key] (${newer[key]}) < older[key] (${older[key]})`
        );
        break;
      case "boolean":
        assert(
          newer[key] === older[key],
          `${key} in ${parent} did not match: newer[key] (${newer[key]}) !== older[key] (${older[key]})`
        );
        break;
      default:
        assertJsonNewer(newer[key], older[key], log, key);
    }
  }
}

function generatePackageJson(name: string, version: string, typesPublisherContentHash: string): object {
  const json = {
    name,
    version,
    description: "A registry of TypeScript declaration file packages published within the @types scope.",
    repository: pkg.repository,
    keywords: ["TypeScript", "declaration", "files", "types", "packages"],
    author: "Microsoft Corp.",
    license: "MIT",
    typesPublisherContentHash,
  };
  return json;
}

interface Registry {
  readonly entries: {
    readonly [typesDirectoryName: string]: {
      readonly [distTags: string]: string;
    };
  };
}
async function generateRegistry(typings: readonly TypingsData[]): Promise<Registry> {
  return {
    entries: Object.fromEntries(
      await Promise.all(
        typings.map(async (typing) => [
          typing.typesDirectoryName,
          filterTags((await pacote.packument(typing.name, { cache: cacheDir }))["dist-tags"]),
        ])
      )
    ),
  };

  function filterTags(tags: pacote.Packument["dist-tags"]): { readonly [tag: string]: string } {
    return Object.fromEntries(
      Object.entries(tags).filter(([tag, version]) => tag === "latest" || version !== tags.latest)
    );
  }
}

interface ProcessedNpmInfo {
  readonly latestVersion: string;
  readonly maxVersion: string;
  readonly latestContentHash: unknown;
}

async function fetchAndProcessNpmInfo(packageName: string): Promise<ProcessedNpmInfo> {
  const info = await pacote.packument(packageName, { cache: cacheDir, fullMetadata: true });
  const latestVersion = info["dist-tags"].latest;
  const maxVersion = semver.maxSatisfying(Object.keys(info.versions), "*");
  assert.strictEqual(maxVersion, info["dist-tags"].next);
  return { latestVersion, maxVersion, latestContentHash: info.versions[latestVersion].typesPublisherContentHash };
}

const yargs = require("yargs");
const process = require("process");
const os = require("os");

const {
  withNpmCache,
  NpmPublishClient,
  UncachedNpmInfoClient,
  consoleLogger,
  logUncaughtErrors,
  loggerWithErrors,
  Registry,
  nAtATime
} = require("@definitelytyped/utils");
const { AllPackages, parseDefinitions, getDefinitelyTyped } = require("@definitelytyped/definitions-parser");
const {
  updateLatestTag,
  updateTypeScriptVersionTags,
  getLatestTypingVersion
} = require("@definitelytyped/publisher");

logUncaughtErrors(main);

async function main() {
    const  { dry, nProcesses, name } = yargs.options({
        dry: { type: "boolean", default: false },
        nProcesses: { type: "number", default: os.cpus().length },
        name: { type: "string" }
    }).argv;
    await tag(dry, false, nProcesses, name);
    await tag(dry, true, nProcesses, name);
}

/**
 * Refreshes the tags on every package.
 * This needs to be run whenever a new version of Typescript is released.
 *
 * It can also refresh the tags on a single package, which can un-wedge types-publisher in certain cases.
 * This shouldn't normally need to run, since we run `tagSingle` whenever we publish a package.
 * But this should be run if the way we calculate tags changes (e.g. when a new release is allowed to be tagged "latest").
 * @param {boolean} dry
 * @param {boolean} github
 * @param {number} nProcesses
 * @param {string} [name]
 * @return {Promise<void>}
 */
async function tag(dry, github, nProcesses, name) {
  const log = loggerWithErrors()[0];
  const options = { definitelyTypedPath: "../DefinitelyTyped", progress: true, parseInParallel: true };
  await parseDefinitions(
    await getDefinitelyTyped(options, log),
      { nProcesses: nProcesses || os.cpus().length, definitelyTypedPath: "../DefinitelyTyped" },
    log
  );

  const registryName = github ? Registry.Github : Registry.NPM;
  const token =
    /** @type {string} */ (registryName === Registry.Github ? process.env.GH_API_TOKEN : process.env.NPM_TOKEN);

  const publishClient = await NpmPublishClient.create(token, {}, registryName);
  await withNpmCache(new UncachedNpmInfoClient(), async infoClient => {
    if (name) {
      const pkg = await AllPackages.readSingle(name);
      const version = await getLatestTypingVersion(pkg, infoClient);
      await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
      await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
    } else {
      await nAtATime(10, await AllPackages.readLatestTypings(), async pkg => {
        // Only update tags for the latest version of the package.
        const version = await getLatestTypingVersion(pkg, infoClient);
        await updateTypeScriptVersionTags(pkg, version, publishClient, consoleLogger.info, dry);
        await updateLatestTag(pkg.fullNpmName, version, publishClient, consoleLogger.info, dry);
      });
    }
  });
  // Don't tag notNeeded packages
}

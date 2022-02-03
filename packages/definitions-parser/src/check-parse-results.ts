import { ParseDefinitionsOptions } from "./get-definitely-typed";
import { TypingsData, AllPackages, formatTypingVersion } from "./packages";
import {
  assertDefined,
  best,
  mapDefined,
  nAtATime,
  FS,
  logger,
  writeLog,
  Logger,
  Semver,
  UncachedNpmInfoClient,
  NpmInfoRawVersions,
  NpmInfoVersion
} from "@definitelytyped/utils";

export async function checkParseResults(
  includeNpmChecks: false,
  dt: FS,
  options: ParseDefinitionsOptions
): Promise<void>;
export async function checkParseResults(
  includeNpmChecks: true,
  dt: FS,
  options: ParseDefinitionsOptions,
  client: UncachedNpmInfoClient
): Promise<void>;
export async function checkParseResults(
  includeNpmChecks: boolean,
  dt: FS,
  options: ParseDefinitionsOptions,
  client?: UncachedNpmInfoClient
): Promise<void> {
  const allPackages = await AllPackages.read(dt);
  const [log, logResult] = logger();

  checkTypeScriptVersions(allPackages);

  checkPathMappings(allPackages);

  const dependedOn = new Set<string>();
  const packages = allPackages.allPackages();
  for (const pkg of packages) {
    if (pkg instanceof TypingsData) {
      for (const dep of Object.keys(pkg.dependencies)) {
        dependedOn.add(dep);
      }
      for (const dep of pkg.testDependencies) {
        dependedOn.add(dep);
      }
    }
  }

  if (includeNpmChecks) {
    await nAtATime(
      10,
      allPackages.allTypings(),
      pkg => checkNpm(pkg, log, dependedOn, client!),
      options.progress
        ? {
            name: "Checking for typed packages...",
            flavor: pkg => pkg.desc
          }
        : undefined
    );
  }

  await writeLog("conflicts.md", logResult());
}

function checkTypeScriptVersions(allPackages: AllPackages): void {
  for (const pkg of allPackages.allTypings()) {
    for (const dep of allPackages.allDependencyTypings(pkg)) {
      if (dep.minTypeScriptVersion > pkg.minTypeScriptVersion) {
        throw new Error(`${pkg.desc} depends on ${dep.desc} but has a lower required TypeScript version.`);
      }
    }
  }
}

export function checkPathMappings(allPackages: AllPackages): void {
  for (const pkg of allPackages.allTypings()) {
    const unusedPathMappings = new Set(Object.keys(pkg.pathMappings).filter(m => m !== pkg.name && m !== pkg.unescapedName));

    // If A depends on B, and B has path mappings, A must have the same mappings.
    for (const dependency of allPackages.allDependencyTypings(pkg)) {
      for (const [transitiveDependencyName, transitiveDependencyVersion] of Object.entries(dependency.pathMappings)) {
        const pathMappingVersion = pkg.pathMappings[transitiveDependencyName];
        if (
          pathMappingVersion &&
          (pathMappingVersion.major !== transitiveDependencyVersion.major ||
            pathMappingVersion.minor !== transitiveDependencyVersion.minor)
        ) {
          const expectedPathMapping = `${transitiveDependencyName}/v${formatTypingVersion(
            transitiveDependencyVersion
          )}`;
          throw new Error(
            `${pkg.desc} depends on ${dependency.desc}, which has a path mapping for ${expectedPathMapping}. ` +
              `${pkg.desc} must have the same path mappings as its dependencies.`
          );
        }
        unusedPathMappings.delete(transitiveDependencyName);
      }
      unusedPathMappings.delete(dependency.name);
    }
    if (unusedPathMappings.size > 0) {
      throw new Error(`${pkg.desc} has unused path mappings for [${Array.from(unusedPathMappings).join(", ")}].
If these mappings are actually used, they could be missing in a dependency's tsconfig.json instead.
Check the path mappings for [${Array.from(allPackages.allDependencyTypings(pkg)).map(d => d.name).join(", ")}].`);
    }
  }
}

async function checkNpm(
  { major, minor, name, libraryName, projectName, contributors }: TypingsData,
  log: Logger,
  dependedOn: ReadonlySet<string>,
  client: UncachedNpmInfoClient
): Promise<void> {
  if (notNeededExceptions.has(name)) {
    return;
  }

  const info = await client.fetchRawNpmInfo(name); // Gets info for the real package, not the @types package
  if (!info) {
    return;
  }

  const versions = getRegularVersions(info.versions);
  const firstTypedVersion = best(
    mapDefined(versions, ({ hasTypes, version }) => (hasTypes ? version : undefined)),
    (a, b) => b.greaterThan(a)
  );
  // A package might have added types but removed them later, so check the latest version too
  if (firstTypedVersion === undefined || !best(versions, (a, b) => a.version.greaterThan(b.version))!.hasTypes) {
    return;
  }

  const ourVersion = `${major}.${minor}`;

  log("");
  log(
    `Typings already defined for ${name} (${libraryName}) as of ${firstTypedVersion.versionString} (our version: ${ourVersion})`
  );
  const contributorUrls = contributors
    .map(c => {
      const gh = "https://github.com/";
      return c.url.startsWith(gh) ? `@${c.url.slice(gh.length)}` : `${c.name} (${c.url})`;
    })
    .join(", ");
  log("  To fix this:");
  log(`  git checkout -b not-needed-${name}`);
  const yarnargs = [name, firstTypedVersion.versionString, projectName];
  if (libraryName !== name) {
    yarnargs.push(JSON.stringify(libraryName));
  }
  log("  yarn not-needed " + yarnargs.join(" "));
  log(`  git add --all && git commit -m "${name}: Provides its own types" && git push -u origin not-needed-${name}`);
  log(`  And comment PR: This will deprecate \`@types/${name}\` in favor of just \`${name}\`. CC ${contributorUrls}`);
  if (new Semver(major, minor, 0).greaterThan(firstTypedVersion)) {
    log("  WARNING: our version is greater!");
  }
  if (dependedOn.has(name)) {
    log("  WARNING: other packages depend on this!");
  }
}

export async function packageHasTypes(packageName: string, client: UncachedNpmInfoClient): Promise<boolean> {
  const info = assertDefined(await client.fetchRawNpmInfo(packageName));
  return versionHasTypes(info.versions[info["dist-tags"].latest]);
}

function getRegularVersions(
  versions: NpmInfoRawVersions
): readonly { readonly version: Semver; readonly hasTypes: boolean }[] {
  return mapDefined(Object.entries(versions), ([versionString, info]) => {
    const version = Semver.tryParse(versionString);
    return version === undefined ? undefined : { version, hasTypes: versionHasTypes(info) };
  });
}

function versionHasTypes(info: NpmInfoVersion): boolean {
  return "types" in info || "typings" in info;
}

const notNeededExceptions: ReadonlySet<string> = new Set([
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22306
  "angular-ui-router",
  "ui-router-extras",
  // Declares to bundle types, but they're also in the `.npmignore` (https://github.com/nkovacic/angular-touchspin/issues/21)
  "angular-touchspin",
  // "typings" points to the wrong file (https://github.com/Microsoft/Bing-Maps-V8-TypeScript-Definitions/issues/31)
  "bingmaps",
  // Types are bundled, but not officially released (https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22313#issuecomment-353225893)
  "dwt",
  // Waiting on some typing errors to be fixed (https://github.com/julien-c/epub/issues/30)
  "epub",
  // Typings file is not in package.json "files" list (https://github.com/silentmatt/expr-eval/issues/127)
  "expr-eval",
  // NPM package "express-serve-static-core" isn't a real package -- express-serve-static-core exists only for the purpose of types
  "express-serve-static-core",
  // Has "typings": "index.d.ts" but does not actually bundle typings. https://github.com/kolodny/immutability-helper/issues/79
  "immutability-helper",
  // Has `"typings": "compiled/typings/node-mysql-wrapper/node-mysql-wrapper.d.ts",`, but `compiled/typings` doesn't exist.
  // Package hasn't updated in 2 years and author seems to have deleted their account, so no chance of being fixed.
  "node-mysql-wrapper",
  // raspi packages bundle types, but can only be installed on a Raspberry Pi, so they are duplicated to DefinitelyTyped.
  // See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/21618
  "raspi",
  "raspi-board",
  "raspi-gpio",
  "raspi-i2c",
  "raspi-led",
  "raspi-onewire",
  "raspi-peripheral",
  "raspi-pwm",
  "raspi-serial",
  "raspi-soft-pwm",
  // Declare "typings" but don't actually have them yet (https://github.com/stampit-org/stampit/issues/245)
  "stampit"
]);

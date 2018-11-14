import * as fold from "travis-fold";

import { FS, getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { NpmInfoRawVersions, NpmInfoVersion, UncachedNpmInfoClient } from "./lib/npm-client";
import { AllPackages, AnyPackage, TypingsData } from "./lib/packages";
import { Semver } from "./lib/versions";
import { Logger, logger, writeLog } from "./util/logging";
import { assertDefined, best, logUncaughtErrors, mapDefined, multiMapAdd, nAtATime } from "./util/util";

if (!module.parent) {
	logUncaughtErrors(async () => checkParseResults(true, await getDefinitelyTyped(Options.defaults), Options.defaults, new UncachedNpmInfoClient()));
}

export default async function checkParseResults(includeNpmChecks: boolean, dt: FS, options: Options, client: UncachedNpmInfoClient): Promise<void> {
	const allPackages = await AllPackages.read(dt);
	const [log, logResult] = logger();

	checkTypeScriptVersions(allPackages);

	checkPathMappings(allPackages);

	if (fold.isTravis()) { console.log(fold.start("Duplicate packages")); }
	const packages = allPackages.allPackages();
	checkForDuplicates(packages, pkg => pkg.libraryName, "Library Name", log);
	checkForDuplicates(packages, pkg => pkg.projectName, "Project Name", log);
	if (fold.isTravis()) { console.log(fold.end("Duplicate packages")); }

	const dependedOn = new Set<string>();
	for (const pkg of packages) {
		if (pkg instanceof TypingsData) {
			for (const dep of pkg.dependencies) {
				dependedOn.add(dep.name);
			}
			for (const dep of pkg.testDependencies) {
				dependedOn.add(dep);
			}
		}
	}

	if (includeNpmChecks) {
		await nAtATime(10, allPackages.allTypings(), pkg => checkNpm(pkg, log, dependedOn, client), {
			name: "Checking for typed packages...",
			flavor: pkg => pkg.desc,
			options,
		});
	}

	await writeLog("conflicts.md", logResult());
}

function checkForDuplicates(packages: ReadonlyArray<AnyPackage>, func: (info: AnyPackage) => string | undefined, key: string, log: Logger): void {
	const lookup = new Map<string, TypingsData[]>();
	for (const info of packages) {
		const libraryOrProjectName = func(info);
		if (libraryOrProjectName !== undefined) {
			multiMapAdd(lookup, libraryOrProjectName, info);
		}
	}

	for (const [libName, values] of lookup) {
		if (values.length > 1) {
			log(` * Duplicate ${key} descriptions "${libName}"`);
			for (const n of values) {
				log(`   * ${n.desc}`);
			}
		}
	}
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

function checkPathMappings(allPackages: AllPackages): void {
	for (const pkg of allPackages.allTypings()) {
		const pathMappings = new Map(pkg.pathMappings.map((p): [string, number] => [p.packageName, p.majorVersion]));
		const unusedPathMappings = new Set(pathMappings.keys());

		// If A depends on B, and B has path mappings, A must have the same mappings.
		for (const dependency of allPackages.allDependencyTypings(pkg)) {
			for (const { packageName, majorVersion } of dependency.pathMappings) {
				if (pathMappings.get(packageName) !== majorVersion) {
					throw new Error(
						`${pkg.desc} depends on ${dependency.desc}, which has a path mapping for ${packageName} v${majorVersion}. ` +
						`${pkg.desc} must have the same path mappings as its dependencies.`);
				}
				unusedPathMappings.delete(packageName);
			}

			unusedPathMappings.delete(dependency.name);
		}

		for (const unusedPathMapping of unusedPathMappings) {
			if (pkg.name !== unusedPathMapping) {
				throw new Error(`${pkg.desc} has unused path mapping for ${unusedPathMapping}`);
			}
		}
	}
}

async function checkNpm(
	{ major, minor, name, libraryName, projectName, contributors }: TypingsData,
	log: Logger,
	dependedOn: ReadonlySet<string>,
	client: UncachedNpmInfoClient,
): Promise<void> {
	if (notNeededExceptions.has(name)) {
		return;
	}

	const info = await client.fetchRawNpmInfo(name); // Gets info for the real package, not the @types package
	if (!info) { return; }

	const versions = getRegularVersions(info.versions);
	const firstTypedVersion = best(mapDefined(versions, ({ hasTypes, version }) => hasTypes ? version : undefined), (a, b) => b.greaterThan(a));
	// A package might have added types but removed them later, so check the latest version too
	if (firstTypedVersion === undefined || !best(versions, (a, b) => a.version.greaterThan(b.version))!.hasTypes) {
		return;
	}

	const ourVersion = `${major}.${minor}`;

	log("");
	log(`Typings already defined for ${name} (${libraryName}) as of ${firstTypedVersion.versionString} (our version: ${ourVersion})`);
	const contributorUrls = contributors.map(c => {
		const gh = "https://github.com/";
		return c.url.startsWith(gh) ? `@${c.url.slice(gh.length)}` : `${c.name} (${c.url})`;
	}).join(", ");
	log("  To fix this:");
	log(`  git checkout -b not-needed-${name}`);
	log(`  yarn not-needed ${name} ${firstTypedVersion.versionString} ${projectName}${libraryName !== name ? ` ${JSON.stringify(libraryName)}` : ""}`);
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

function getRegularVersions(versions: NpmInfoRawVersions): ReadonlyArray<{ readonly version: Semver; readonly hasTypes: boolean; }> {
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
	"angular-ui-router", "ui-router-extras",
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
	"raspi", "raspi-board", "raspi-gpio", "raspi-i2c", "raspi-led", "raspi-onewire", "raspi-peripheral", "raspi-pwm", "raspi-serial", "raspi-soft-pwm",
	// Declare "typings" but don't actually have them yet (https://github.com/stampit-org/stampit/issues/245)
	"stampit",
]);

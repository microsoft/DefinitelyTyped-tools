import * as semver from "semver";
import { Options, settings } from "./lib/common";
import { AllPackages, TypingsData } from "./lib/packages";
import { Logger, logger, writeLog } from "./util/logging";
import { fetchJson} from "./util/io";
import { best, done, multiMapAdd, nAtATime } from "./util/util";

if (!module.parent) {
	done(main(true, Options.defaults));
}

export default async function main(includeNpmChecks: boolean, options: Options): Promise<void> {
	const packages = await AllPackages.readTypings();
	const [log, logResult] = logger();
	check(packages, info => info.libraryName, "Library Name", log);
	check(packages, info => info.projectName, "Project Name", log);
	if (includeNpmChecks) {
		await nAtATime(10, packages, pkg => checkNpm(pkg, log), {
			name: "Checking for typed packages...",
			flavor: pkg => pkg.desc,
			options
		});
	}
	await writeLog("conflicts.md", logResult());
}

function check(infos: TypingsData[], func: (info: TypingsData) => string | undefined, key: string, log: Logger): void {
	const lookup = new Map<string, TypingsData[]>();
	for (const info of infos) {
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

async function checkNpm(pkg: TypingsData, log: Logger): Promise<void> {
	const asOfVersion = await firstPackageVersionWithTypes(pkg.name);
	if (asOfVersion) {
		const ourVersion = `${pkg.major}.${pkg.minor}`;
		log(`Typings already defined for ${pkg.name} (${pkg.libraryName}) as of ${asOfVersion} (our version: ${ourVersion})`);
	}
}

export async function packageHasTypes(packageName: string): Promise<boolean> {
	return (await firstPackageVersionWithTypes(packageName)) !== undefined;
}

async function firstPackageVersionWithTypes(packageName: string): Promise<string | undefined> {
	const uri = settings.npmRegistry + packageName;
	const info = await fetchJson(uri, { retries: true });
	// Info may be empty if the package is not on NPM
	if (!info.versions) {
		return undefined;
	}

	return firstVersionWithTypes(info.versions);
}

function firstVersionWithTypes(versions: { [version: string]: any }): string | undefined {
	const versionsWithTypings = Object.entries(versions).filter(([_version, info]) => hasTypes(info)).map(([version]) => version);
	return best(versionsWithTypings, semver.lt);
}

function hasTypes(info: any): boolean {
	return "types" in info || "typings" in info;
}

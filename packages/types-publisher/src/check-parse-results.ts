import * as semver from "semver";
import { settings } from "./lib/common";
import { AllPackages, TypingsData } from "./lib/packages";
import { Logger, logger, writeLog } from "./util/logging";
import { fetchJson} from "./util/io";
import { best, done, nAtATime } from "./util/util";

if (!module.parent) {
	done(main(true));
}

export default async function main(includeNpmChecks: boolean): Promise<void> {
	const packages = await AllPackages.readTypings();
	const [log, logResult] = logger();
	check(packages, info => info.libraryName, "Library Name", log);
	check(packages, info => info.projectName, "Project Name", log);
	if (includeNpmChecks) {
		await nAtATime(10, packages, pkg => checkNpm(pkg, log), {
			name: "Checking for typed packages...",
			flavor: pkg => pkg.typingsPackageName
		});
	}
	await writeLog("conflicts.md", logResult());
}

function check(infos: TypingsData[], func: (info: TypingsData) => string | undefined, key: string, log: Logger): void {
	const lookup: { [libName: string]: string[] } = {};
	infos.forEach(info => {
		const name = func(info);
		if (name !== undefined) {
			(lookup[name] || (lookup[name] = [])).push(info.typingsPackageName);
		}
	});
	for (const k of Object.keys(lookup)) {
		if (lookup[k].length > 1) {
			log(` * Duplicate ${key} descriptions "${k}"`);
			lookup[k].forEach(n => log(`   * ${n}`));
		}
	}
}

async function checkNpm(pkg: TypingsData, log: Logger): Promise<void> {
	const asOfVersion = await firstPackageVersionWithTypes(pkg.typingsPackageName);
	if (asOfVersion) {
		const ourVersion = `${pkg.libraryMajorVersion}.${pkg.libraryMinorVersion}`;
		log(`Typings already defined for ${pkg.typingsPackageName} (${pkg.libraryName}) as of ${asOfVersion} (our version: ${ourVersion})`);
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

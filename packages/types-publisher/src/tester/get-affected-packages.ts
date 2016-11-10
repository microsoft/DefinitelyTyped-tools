import { Options, TypesDataFile, TypingsData, readTypesDataFile, settings, typingsFromData } from "../lib/common";
import { Logger } from "../util/logging";
import { done, execAndThrowErrors } from "../util/util";

if (!module.parent) {
	done(main(Options.defaults));
}
async function main(options: Options) {
	const changes = await getAffectedPackages(console.log, options);
	console.log(Array.from(changes).map(t => t.typingsPackageName));
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export default async function getAffectedPackages(log: Logger, options: Options): Promise<TypingsData[]> {
	const changedPackageNames = await gitChanges(log, options);
	const typings = await readTypesDataFile();
	const dependedOn = getReverseDependencies(typings);
	return collectDependers(typings, changedPackageNames, dependedOn);
}

/** Collect all packages that depend on changed packages, and all that depend on those, etc. */
function collectDependers(typings: TypesDataFile, changedPackageNames: Iterable<string>, reverseDependencies: Map<TypingsData, Set<TypingsData>>) {
	// All packages that have change or depend on something in allDependers.
	const allDependers = new Set<TypingsData>();
	// Packages that we need to collect dependers for.
	const workList: TypingsData[] = [];

	function add(typing: TypingsData) {
		if (!allDependers.has(typing)) {
			allDependers.add(typing);
			workList.push(typing);
		}
	}

	for (const pkg of changedPackageNames) {
		if (pkg in typings) {
			add(typings[pkg]);
		}
	}

	while (workList.length) {
		const t = workList.pop()!;
		for (const depender of reverseDependencies.get(t)!) {
			add(depender);
		}
	}

	return Array.from(allDependers).sort((a, b) => a.typingsPackageName.localeCompare(b.typingsPackageName));
}

/** Generate a map from a package to packages that depend on it. */
function getReverseDependencies(typesData: TypesDataFile): Map<TypingsData, Set<TypingsData>> {
	const map = new Map<TypingsData, Set<TypingsData>>();
	const typings = typingsFromData(typesData);

	for (const typing of typings) {
		map.set(typing, new Set());
	}

	for (const typing of typings) {
		for (const dependencyName of typing.libraryDependencies.concat(typing.moduleDependencies)) {
			const dependency = typesData[dependencyName];
			if (dependency) {
				map.get(dependency)!.add(typing);
			}
		}
	}

	return map;
}

/** Returns all immediate subdirectories of the root directory that have changed. */
async function gitChanges(log: Logger, options: Options): Promise<Iterable<string>> {
	const changedPackages = new Set<string>();

	for (const fileName of await gitDiff(log, options)) {
		const root = rootDirName(fileName);
		if (root) {
			changedPackages.add(root);
		}
	}

	return changedPackages;
}

/*
We have to be careful about how we get the diff because travis uses a shallow clone.

Travis runs:
    git clone --depth=50 https://github.com/DefinitelyTyped/DefinitelyTyped.git DefinitelyTyped
    cd DefinitelyTyped
    git fetch origin +refs/pull/123/merge
    git checkout -qf FETCH_HEAD

If editing this code, be sure to test on both full and shallow clones.
*/
async function gitDiff(log: Logger, options: Options): Promise<string[]> {
	try {
		await run(`git rev-parse --verify ${settings.sourceBranch}`);
		// If this succeeds, we got the full clone.
	} catch (_) {
		// This is a shallow clone.
		await run(`git fetch origin ${settings.sourceBranch}`);
		await run(`git branch ${settings.sourceBranch} FETCH_HEAD`);
	}

	// `git diff foo...bar` gets all changes from X to `bar` where X is the common ancestor of `foo` and `bar`.
	// Source: https://git-scm.com/docs/git-diff
	const diff = await run(`git diff ${settings.sourceBranch}...HEAD --name-only`);
	return diff.trim().split("\n");

	async function run(cmd: string): Promise<string> {
		log("Running: " + cmd);
		const stdout = await execAndThrowErrors(cmd, options.definitelyTypedPath);
		log(stdout);
		return stdout;
	}
}

// For "a/b/c", returns "a". For "a", returns undefined.
function rootDirName(fileName: string): string | undefined {
	const slash = fileName.indexOf("/");
	return slash === -1 ? undefined : fileName.slice(0, slash);
}

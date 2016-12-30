import { Options,  settings } from "../lib/common";
import { AllPackages, TypingsData } from "../lib/packages";
import { Logger } from "../util/logging";
import { done, execAndThrowErrors } from "../util/util";

if (!module.parent) {
	done(main(Options.defaults));
}
async function main(options: Options) {
	const changes = await getAffectedPackages(await AllPackages.read(options), console.log, options);
	console.log(Array.from(changes).map(t => t.typingsPackageName));
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export default async function getAffectedPackages(allPackages: AllPackages, log: Logger, options: Options): Promise<TypingsData[]> {
	const changedPackageNames = await gitChanges(log, options);
	const dependedOn = getReverseDependencies(allPackages);
	return collectDependers(allPackages, changedPackageNames, dependedOn);
}

/** Every package name in the original list, plus their dependencies (incl. dependencies' dependencies). */
export function allDependencies(allPackages: AllPackages, packages: TypingsData[]): TypingsData[] {
	return Array.from(transitiveClosure(packages, pkg => packagesFromNames(allPackages, getDependencies(pkg))));
}

/** Collect all packages that depend on changed packages, and all that depend on those, etc. */
function collectDependers(allPackages: AllPackages, changedPackageNames: Iterable<string>, reverseDependencies: Map<TypingsData, Set<TypingsData>>) {
	return sortPackages(transitiveClosure(packagesFromNames(allPackages, changedPackageNames), pkg => reverseDependencies.get(pkg) || []));
}

function transitiveClosure<T>(initialItems: Iterable<T>, getRelatedItems: (item: T) => Iterable<T>): Set<T> {
	const all = new Set<T>();
	const workList: T[] = [];

	function add(item: T) {
		if (!all.has(item)) {
			all.add(item);
			workList.push(item);
		}
	}

	for (const item of initialItems) {
		add(item);
	}

	while (workList.length) {
		const item = workList.pop()!;
		for (const newItem of getRelatedItems(item)) {
			add(newItem);
		}
	}

	return all;
}

function* packagesFromNames(allPackages: AllPackages, names: Iterable<string>): IterableIterator<TypingsData> {
	for (const name of names) {
		const pkg = allPackages.tryGetTypingsData(name);
		if (pkg) {
			yield pkg;
		}
	}
}

function sortPackages(packages: Iterable<TypingsData>): TypingsData[] {
	return Array.from(packages).sort((a, b) => a.typingsPackageName.localeCompare(b.typingsPackageName));
}

/** Generate a map from a package to packages that depend on it. */
function getReverseDependencies(allPackages: AllPackages): Map<TypingsData, Set<TypingsData>> {
	const map = new Map<TypingsData, Set<TypingsData>>();

	for (const typing of allPackages.allTypings()) {
		map.set(typing, new Set());
	}

	for (const typing of allPackages.allTypings()) {
		for (const dependencyName of getDependencies(typing)) {
			const dependency = allPackages.tryGetTypingsData(dependencyName);
			if (dependency) {
				map.get(dependency)!.add(typing);
			}
		}
	}

	return map;
}

function getDependencies(typing: TypingsData): string[] {
	return typing.libraryDependencies.concat(typing.moduleDependencies);
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

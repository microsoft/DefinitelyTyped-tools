import { AllPackages, formatDependencyVersion, getMangledNameForScopedPackage, PackageBase, PackageId, TypingsData } from "../lib/packages";
import { mapDefined, mapIter, sort } from "../util/util";

export interface Affected {
    readonly changedPackages: ReadonlyArray<TypingsData>;
    readonly dependentPackages: ReadonlyArray<TypingsData>;
    allPackages: AllPackages;
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export function getAffectedPackages(allPackages: AllPackages, changedPackageIds: PackageId[]): Affected {
    const resolved = changedPackageIds.map(id => allPackages.tryResolve(id));
    // If a package doesn't exist, that's because it was deleted.
    const changed = mapDefined(resolved, id => allPackages.tryGetTypingsData(id));
    const dependent = mapIter(collectDependers(resolved, getReverseDependencies(allPackages, resolved)), p => allPackages.getTypingsData(p));
    return { changedPackages: changed, dependentPackages: sortPackages(dependent), allPackages };
}

/** Every package name in the original list, plus their dependencies (incl. dependencies' dependencies). */
export function allDependencies(allPackages: AllPackages, packages: Iterable<TypingsData>): TypingsData[] {
    return sortPackages(transitiveClosure(packages, pkg => allPackages.allDependencyTypings(pkg)));
}

/** Collect all packages that depend on changed packages, and all that depend on those, etc. */
function collectDependers(changedPackages: PackageId[], reverseDependencies: Map<PackageId, Set<PackageId>>): Set<PackageId> {
    const dependers = transitiveClosure(changedPackages, pkg => reverseDependencies.get(pkg) || []);
    // Don't include the original changed packages, just their dependers
    for (const original of changedPackages) {
        dependers.delete(original);
    }
    return dependers;
}

function sortPackages(packages: Iterable<TypingsData>): TypingsData[] {
    return sort<TypingsData>(packages, PackageBase.compare); // tslint:disable-line no-unbound-method
}

function transitiveClosure<T>(initialItems: Iterable<T>, getRelatedItems: (item: T) => Iterable<T>): Set<T> {
    const all = new Set<T>();
    const workList: T[] = [];

    function add(item: T): void {
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

/** Generate a map from a package to packages that depend on it. */
function getReverseDependencies(allPackages: AllPackages, changedPackages: PackageId[]): Map<PackageId, Set<PackageId>> {
   const map = new Map<string, [PackageId, Set<PackageId>]>();
   for (const changed of changedPackages) {
         map.set(packageIdToKey(changed), [changed, new Set()]);
    }
   for (const typing of allPackages.allTypings()) {
        if (!map.has(packageIdToKey(typing.id))) {
            map.set(packageIdToKey(typing.id), [typing.id, new Set()]);
        }
    }
   for (const typing of allPackages.allTypings()) {
        for (const dependency of typing.dependencies) {
            const dependencies = map.get(packageIdToKey(allPackages.tryResolve(dependency)));
            if (dependencies) {
                dependencies[1].add(typing.id);
            }
        }
        for (const dependencyName of typing.testDependencies) {
            const latest: PackageId = { name: dependencyName, version: "*" };
            const dependencies = map.get(packageIdToKey(allPackages.tryResolve(latest)));
            if (dependencies) {
                dependencies[1].add(typing.id);
            }
        }
    }
   return new Map(map.values());
}

function packageIdToKey(pkg: PackageId): string {
    return getMangledNameForScopedPackage(pkg.name) + "/v" + formatDependencyVersion(pkg.version);
}

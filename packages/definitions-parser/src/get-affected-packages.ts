import { flatMapIterable, mapDefined, sort } from "@definitelytyped/utils";
import {
  TypingsData,
  AllPackages,
  PackageId,
  PackageBase,
  getMangledNameForScopedPackage,
  formatDependencyVersion
} from "./packages";

export interface Affected {
  readonly changedPackages: readonly TypingsData[];
  readonly dependentPackages: readonly TypingsData[];
  allPackages: AllPackages;
}

/** Gets all packages that have changed on this branch, plus all packages affected by the change. */
export function getAffectedPackages(allPackages: AllPackages, changedPackageIds: PackageId[]): Affected {
  const resolved = changedPackageIds.map(id => allPackages.tryResolve(id));
  // If a package doesn't exist, that's because it was deleted.
  const changed = mapDefined(resolved, id => allPackages.tryGetTypingsData(id));
  const dependent = collectDependers(resolved, getReverseDependencies(allPackages, resolved));
  // Don't include the original changed packages, just their dependers
  for (const original of changed) {
    dependent.delete(original);
  }
  return { changedPackages: changed, dependentPackages: sortPackages(dependent), allPackages };
}

/** Every package name in the original list, plus their dependencies (incl. dependencies' dependencies). */
export function allDependencies(allPackages: AllPackages, packages: Iterable<TypingsData>): TypingsData[] {
  return sortPackages(transitiveClosure(packages, pkg => allPackages.allDependencyTypings(pkg)));
}

/** Collect all packages that depend on changed packages, and all that depend on those, etc. */
function collectDependers(
  changedPackages: PackageId[],
  reverseDependencies: Map<string, TypingsData[]>
): Set<TypingsData> {
  const dependers = transitiveClosure(
    flatMapIterable(changedPackages, id => reverseDependencies.get(packageIdToKey(id)) || []),
    ({ id }) => reverseDependencies.get(packageIdToKey(id)) || []
  );
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
function getReverseDependencies(allPackages: AllPackages, changedPackages: PackageId[]): Map<string, TypingsData[]> {
  const map = new Map<string, TypingsData[]>();
  for (const changed of changedPackages) {
    map.set(packageIdToKey(changed), []);
  }
  for (const typing of allPackages.allTypings()) {
    if (!map.has(packageIdToKey(typing.id))) {
      map.set(packageIdToKey(typing.id), []);
    }
  }
  for (const typing of allPackages.allTypings()) {
    for (const [name, version] of Object.entries(typing.dependencies)) {
      const dependencies = map.get(packageIdToKey(allPackages.tryResolve({ name, version })));
      if (dependencies) {
        dependencies.push(typing);
      }
    }
    for (const dependencyName of typing.testDependencies) {
      const version = typing.pathMappings[dependencyName] || "*";
      const dependencies = map.get(packageIdToKey(allPackages.tryResolve({ name: dependencyName, version })));
      if (dependencies) {
        dependencies.push(typing);
      }
    }
  }
  return map;
}

function packageIdToKey(pkg: PackageId): string {
  return getMangledNameForScopedPackage(pkg.name) + "/v" + formatDependencyVersion(pkg.version);
}

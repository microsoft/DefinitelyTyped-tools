import { flatMapIterable, mapDefined, mapIterable, sort } from "@definitelytyped/utils";
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
  const dependent = collectDependers(resolved, allPackages);
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
function collectDependers(changedPackages: PackageId[], allPackages: AllPackages): Set<TypingsData> {
  const { reverseDependencies, reverseTestDependencies } = getReverseDependencies(allPackages);
  const dependers = transitiveClosure(
    flatMapIterable(changedPackages, id => reverseDependencies[packageIdToKey(id)] || []),
    ({ id }) => reverseDependencies[packageIdToKey(id)] || []
  );
  for (const dependent of [...changedPackages, ...mapIterable(dependers, ({ id }) => id)]) {
    for (const testDependent of reverseTestDependencies[packageIdToKey(dependent)] || []) {
      dependers.add(testDependent);
    }
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
function getReverseDependencies(
  allPackages: AllPackages
): {
  reverseDependencies: { [key: string]: TypingsData[] };
  reverseTestDependencies: { [key: string]: TypingsData[] };
} {
  const reverseDependencies: { [key: string]: TypingsData[] } = {};
  const reverseTestDependencies: { [key: string]: TypingsData[] } = {};
  for (const typing of allPackages.allTypings()) {
    for (const [name, version] of Object.entries(typing.dependencies)) {
      (reverseDependencies[packageIdToKey(allPackages.tryResolve({ name, version }))] ||= []).push(typing);
    }
    for (const dependencyName of typing.testDependencies) {
      const version = typing.pathMappings[dependencyName] || "*";
      (reverseTestDependencies[packageIdToKey(allPackages.tryResolve({ name: dependencyName, version }))] ||= []).push(
        typing
      );
    }
  }
  return { reverseDependencies, reverseTestDependencies };
}

function packageIdToKey(pkg: PackageId): string {
  return getMangledNameForScopedPackage(pkg.name) + "/v" + formatDependencyVersion(pkg.version);
}

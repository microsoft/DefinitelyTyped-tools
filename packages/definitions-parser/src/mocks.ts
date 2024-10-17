import { validatePackageJson } from "@definitelytyped/header-parser";
import { Dir, FS, InMemoryFS, mangleScopedPackage } from "@definitelytyped/utils";
import * as semver from "semver";

export class DTMock {
  public readonly fs: FS;
  private readonly root: Dir;

  constructor() {
    this.root = new Dir(undefined);
    this.root.set(
      "notNeededPackages.json",
      JSON.stringify({
        packages: {
          angular: {
            libraryName: "angular",
            asOfVersion: "1.2.3",
          },
        },
      }),
    );
    this.fs = new InMemoryFS(this.root, "/DefinitelyTyped/");
  }

  public pkgDir(packageName: string): Dir {
    return this.root.subdir("types").subdir(packageName);
  }

  public pkgFS(packageName: string): FS {
    return this.fs.subDir("types").subDir(packageName);
  }

  /**
   * Creates a shallow copy of a package, meaning all entries in the old version directory that will be created refer to the copied entry from the
   * latest version. The only exceptions are the `index.d.ts` and `tsconfig.json` files.
   *
   * The directory name will exactly follow the given `olderVersion`. I.e. `2` will become `v2`, whereas `2.2` will become `v2.2`.
   *
   * @param packageName The package of which an old version is to be added.
   * @param olderVersion The older version that's to be added.
   */
  public addOldVersionOfPackage(packageName: string, olderVersion: `${number}`, fullVersion: string) {
    const latestDir = this.pkgDir(mangleScopedPackage(packageName));
    const index = latestDir.get("index.d.ts") as string;
    if (latestDir.get("package.json") === undefined) {
      throw new Error(`Package ${packageName} does not have a package.json`);
    }
    const packageJson = JSON.parse(latestDir.get("package.json") as string);
    const latestHeader = validatePackageJson(mangleScopedPackage(packageName), packageJson, []);
    if (Array.isArray(latestHeader)) {
      throw new Error(latestHeader.join("\n"));
    }
    const latestVersion = `${latestHeader.libraryMajorVersion}.${latestHeader.libraryMinorVersion}`;
    const olderVersionParsed = semver.coerce(olderVersion)!;

    const oldDir = latestDir.subdir(`v${olderVersion}`);
    const tsconfig = JSON.parse(latestDir.get("tsconfig.json") as string);

    oldDir.set("index.d.ts", index.replace(latestVersion, `${olderVersionParsed.major}.${olderVersionParsed.minor}`));
    oldDir.set("tsconfig.json", JSON.stringify(tsconfig, undefined, 4));
    oldDir.set("package.json", JSON.stringify({ ...packageJson, version: fullVersion }));

    latestDir.forEach((content, entry) => {
      if (
        content !== oldDir &&
        entry !== "index.d.ts" &&
        entry !== "tsconfig.json" &&
        entry !== "package.json" &&
        !(content instanceof Dir && /^v\d+(\.\d+)?$/.test(entry))
      ) {
        oldDir.set(entry, content);
      }
    });

    return oldDir;
  }
}

export function createMockDT() {
  const dt = new DTMock();

  const boring = dt.pkgDir("boring");
  boring.set(
    "index.d.ts",
    `
import * as React from 'react';
export const drills: number;
`,
  );
  boring.set(
    "secondary.d.ts",
    `
import deffo from 'react-default';
import { mammoths } from 'boring/quaternary';
export const hovercars: unknown;
declare module "boring/fake" {
    import { stock } from 'boring/tertiary';
}
declare module "other" {
    export const augmented: true;
}
`,
  );
  boring.set(
    "tertiary.d.ts",
    `
import { stuff } from 'things';
export var stock: number;
`,
  );
  boring.set(
    "quaternary.d.ts",
    `
export const mammoths: object;
`,
  );
  boring.set(
    "commonjs.d.ts",
    `
import vortex = require('vorticon');
declare const australia: {};
export = australia;
`,
  );
  boring.set(
    "v1.d.ts",
    `
export const inane: true | false;
`,
  );
  boring.set(
    "untested.d.ts",
    `
import { help } from 'manual';
export const fungible: false;
`,
  );
  boring.set(
    "boring-tests.ts",
    `
import { superstor } from "super-big-fun-hus";
import { drills } from "boring";
import { hovercars } from "boring/secondary";
import australia = require('boring/commonjs');
import { inane } from "boring/v1";
`,
  );
  boring.set("tsconfig.json", tsconfig(["boring-tests.ts"]));
  boring.set(
    "package.json",
    packageJson("boring", "1.0", {
      "@types/react": "*",
      "@types/react-default": "*",
      "@types/things": "*",
      "@types/vorticon": "*",
      "@types/manual": "*",
      "@types/super-big-fun-hus": "*",
    }),
  );

  const globby = dt.pkgDir("globby");
  globby.set(
    "index.d.ts",
    `/// <reference path="./sneaky.d.ts" />
/// <reference types="andere/snee" />
declare var x: number
`,
  );

  globby.set(
    "sneaky.d.ts",
    `
declare var ka: number
`,
  );
  globby.set(
    "globby-tests.ts",
    `
var z = x;
`,
  );
  const tests = globby.subdir("test");
  tests.set(
    "other-tests.ts",
    `
var z = y;
`,
  );
  globby.set("tsconfig.json", tsconfig(["globby-tests.ts", "test/other-tests.ts"]));
  globby.set("package.json", packageJson("globby", "1.0", { "@types/andere": "*" }));

  const hasDependency = dt.pkgDir("has-dependency");
  hasDependency.set("index.d.ts", `export * from "moment"`);
  hasDependency.set("has-dependency-tests.ts", "");
  hasDependency.set("tsconfig.json", tsconfig(["has-dependency-tests.ts"]));
  hasDependency.set("package.json", packageJson("has-dependency", "1.0", { moment: "*" }));

  const hasOlderTestDependency = dt.pkgDir("has-older-test-dependency");
  hasOlderTestDependency.set("index.d.ts", ``);
  hasOlderTestDependency.set(
    "has-older-test-dependency-tests.ts",
    `import "jquery";
`,
  );
  hasOlderTestDependency.set(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {},
      files: ["index.d.ts", "has-older-test-dependency-tests.ts"],
    }),
  );
  hasOlderTestDependency.set(
    "package.json",
    packageJson("has-older-test-dependency", "1.0", { "@types/jquery": "1.0" }),
  );

  const jquery = dt.pkgDir("jquery");
  jquery.set(
    "JQuery.d.ts",
    `
declare var jQuery: 1;
`,
  );
  jquery.set(
    "index.d.ts",
    `/// <reference path="JQuery.d.ts" />

export = jQuery;
`,
  );
  jquery.set(
    "jquery-tests.ts",
    `
console.log(jQuery);
`,
  );
  jquery.set("tsconfig.json", tsconfig(["jquery-tests.ts"]));
  jquery.set("package.json", packageJson("jquery", "3.3", {}));

  const scoped = dt.pkgDir("wordpress__plugins");
  scoped.set(
    "index.d.ts",
    `
`,
  );
  scoped.set("package.json", packageJson("wordpress__plugins", "1.0", {}));
  scoped.set(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@wordpress/*": ["wordpress__*"],
        },
      },
      files: ["index.d.ts"],
    }),
  );

  const allowedDep = dt.pkgDir("allowed-dep");
  allowedDep.set("package.json", packageJson("allowed-dep", "1.0", { "prettier": "*" }));

  const nonAllowedDep = dt.pkgDir("non-allowed-dep");
  nonAllowedDep.set("package.json", packageJson("non-allowed-dep", "1.0", { "not-allowed": "*" }));

  const allowedPeerDep = dt.pkgDir("allowed-peer-dep");
  allowedPeerDep.set("package.json", packageJson("allowed-peer-dep", "1.0", {}, { "prettier": "*" }));

  const nonAllowedPeerDep = dt.pkgDir("non-allowed-peer-dep");
  nonAllowedPeerDep.set("package.json", packageJson("non-allowed-peer-dep", "1.0", {}, { "not-allowed-peer": "*" }));

  return dt;
}

function tsconfig(testNames: string[]) {
  return `{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6",
            "dom"
        ],
        "target": "es6",
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "baseUrl": "../",
        "typeRoots": [
            "../"
        ],
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
${testNames.map((s) => "        " + JSON.stringify(s)).join(",\n")}
    ]
}`;
}

function packageJson(packageName: string, version: string, dependencies: Record<string, string>, peerDependencies?: Record<string, string>) {
  return `{
    "private": true,
    "name": "@types/${packageName}",
    "version": "${version}.9999",
    "projects": ["https://project"],
    "owners": [{
        "name": "The Dragon Quest Slime",
        "githubUsername": "slime"
    }],
    "dependencies": {
        ${Object.entries(dependencies)
          .map(([name, version]) => `        "${name}": "${version}"`)
          .join(",\n")}
    },
    ${peerDependencies ? `"peerDependencies": {
        ${Object.entries(peerDependencies)
          .map(([name, version]) => `        "${name}": "${version}"`)
          .join(",\n")}
    },` : ""}
    "devDependencies": {
        "@types/${packageName}": "workspace:."
    }
}`;
}

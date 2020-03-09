import assert = require("assert");
import { exec } from "child_process";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";

/*

  # How to add new version of Typescript #

  For the RC:

  1. Add a new version to the end of `supportedTags`.
  2. Update failing tests.
  3. Publish and update dependents.

  For the release:

  1. Add new versions to the end of `TypeScriptVersion` and `supported`.
  2. Update failing tests.
  3. Publish and update dependents.

  # How to deprecate versions on Definitely Typed #

  1. Move versions from `TypeScriptVersion` to `UnsupportedTypeScriptVersion`.
  2. Move versions from `supported` to `unsupported`.
  3. Remove entry from `supportedTags`.
  4. Update failing tests.
  5. Publish and update dependents.

*/

const installsDir = path.join(os.homedir(), ".dts", "typescript-installs");

/** Parseable but unsupported TypeScript versions. */
export type UnsupportedTypeScriptVersion = "2.0" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5" | "2.6" | "2.7";
/**
 * Parseable and supported TypeScript versions.
 * Only add to this list if we will support this version on DefinitelyTyped.
 */
export type TypeScriptVersion =
  | "2.8"
  | "2.9"
  | "3.0"
  | "3.1"
  | "3.2"
  | "3.3"
  | "3.4"
  | "3.5"
  | "3.6"
  | "3.7"
  | "3.8"
  | "3.9";

export type AllTypeScriptVersion = UnsupportedTypeScriptVersion | TypeScriptVersion;

export type TsVersion = TypeScriptVersion | "next" | "local";

export namespace TypeScriptVersion {
  export const supported: readonly TypeScriptVersion[] = [
    "2.8",
    "2.9",
    "3.0",
    "3.1",
    "3.2",
    "3.3",
    "3.4",
    "3.5",
    "3.6",
    "3.7",
    "3.8",
    "3.9"
  ];
  export const unsupported: readonly UnsupportedTypeScriptVersion[] = [
    "2.0",
    "2.1",
    "2.2",
    "2.3",
    "2.4",
    "2.5",
    "2.6",
    "2.7"
  ];
  export const all: readonly AllTypeScriptVersion[] = [...unsupported, ...supported];
  export const lowest = supported[0];
  /** Latest version that may be specified in a `// TypeScript Version:` header. */
  export const latest = supported[supported.length - 1];

  /** @deprecated */
  export function isPrerelease(_version: TypeScriptVersion): boolean {
    return false;
  }

  export function isSupported(v: AllTypeScriptVersion): v is TypeScriptVersion {
    return supported.indexOf(v as TypeScriptVersion) > -1;
  }

  export function range(min: TypeScriptVersion): readonly TypeScriptVersion[] {
    return supported.filter(v => v >= min);
  }

  const supportedTags: readonly string[] = [
    "ts2.8",
    "ts2.9",
    "ts3.0",
    "ts3.1",
    "ts3.2",
    "ts3.3",
    "ts3.4",
    "ts3.5",
    "ts3.6",
    "ts3.7",
    "ts3.8",
    "ts3.9",
    "latest"
  ];

  /** List of NPM tags that should be changed to point to the latest version. */
  export function tagsToUpdate(v: TypeScriptVersion): readonly string[] {
    const idx = supportedTags.indexOf(`ts${v}`);
    assert(idx !== -1);
    return supportedTags.slice(idx);
  }

  export function previous(v: TypeScriptVersion): TypeScriptVersion | undefined {
    const index = supported.indexOf(v);
    assert(index !== -1);
    return index === 0 ? undefined : supported[index - 1];
  }

  export function isRedirectable(v: TypeScriptVersion): boolean {
    return all.indexOf(v) >= all.indexOf("3.1");
  }
}

export async function installAllTypeScriptVersions() {
  for (const v of TypeScriptVersion.supported) {
    // manually install typescript@next outside the loop
    if (v === TypeScriptVersion.supported[TypeScriptVersion.supported.length - 1]) {
      continue;
    }
    await install(v);
  }
  await installTypeScriptNext();
}

export async function installTypeScriptNext() {
  await install("next");
}

async function install(version: TsVersion): Promise<void> {
  if (version === "local") {
    return;
  }
  const dir = installDir(version);
  if (!(await fs.pathExists(dir))) {
    console.log(`Installing to ${dir}...`);
    await fs.mkdirp(dir);
    await fs.writeJson(path.join(dir, "package.json"), packageJson(version));
    await execAndThrowErrors("npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links", dir);
    console.log("Installed!");
    console.log("");
  }
}

export function cleanTypeScriptInstalls(): Promise<void> {
  return fs.remove(installsDir);
}

export function typeScriptPath(version: TsVersion, tsLocal: string | undefined): string {
  if (version === "local") {
    return tsLocal! + "/typescript.js";
  }
  return path.join(installDir(version), "node_modules", "typescript");
}

function installDir(version: TsVersion): string {
  assert(version !== "local");
  return path.join(installsDir, version);
}

/** Run a command and return the stdout, or if there was an error, throw. */
async function execAndThrowErrors(cmd: string, cwd?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, { encoding: "utf8", cwd }, (err, _stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
      }

      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function packageJson(version: TsVersion): {} {
  return {
    description: `Installs typescript@${version}`,
    repository: "N/A",
    license: "MIT",
    dependencies: {
      typescript: version
    }
  };
}

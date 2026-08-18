import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import fs from "fs";
import { createRequire } from "module";
import path from "path";

export type TsVersion = TypeScriptVersion | "local";

export type LocalTypeScript =
  | { readonly kind: "legacy"; readonly compilerPath: string }
  | {
      readonly kind: "typescript7";
      readonly apiPath: string;
      readonly astPath: string;
      readonly version: string;
    };

export function typeScriptPath(version: TsVersion, tsLocal: string | undefined): string {
  if (version === "local") {
    const localTypeScript = resolveLocalTypeScript(tsLocal!);
    if (localTypeScript.kind !== "legacy") {
      throw new Error(`Expected a TypeScript compiler library at ${tsLocal}.`);
    }
    return localTypeScript.compilerPath;
  }
  return typeScriptPackages.resolve(version);
}

export function resolveLocalTypeScript(tsLocal: string): LocalTypeScript {
  if (!fs.existsSync(tsLocal)) {
    throw new Error(`Could not find the TypeScript build at ${tsLocal}.`);
  }

  const stat = fs.statSync(tsLocal);
  if (stat.isFile()) {
    if (/\.[cm]?js$/i.test(tsLocal)) {
      return { kind: "legacy", compilerPath: tsLocal };
    }
    throw new Error(`The file at ${tsLocal} is not a TypeScript compiler library.`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`The TypeScript build path ${tsLocal} is not a file or directory.`);
  }

  const compilerPath = path.join(tsLocal, "typescript.js");
  if (fs.existsSync(compilerPath) && fs.statSync(compilerPath).isFile()) {
    return { kind: "legacy", compilerPath };
  }

  const packageJsonPath = path.join(tsLocal, "package.json");
  if (!fs.existsSync(packageJsonPath) || !fs.statSync(packageJsonPath).isFile()) {
    throw new Error(`The directory at ${tsLocal} does not contain typescript.js or package.json.`);
  }

  let packageJson: { readonly name?: unknown };
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { readonly name?: unknown };
  } catch (error) {
    throw new Error(`Could not read the TypeScript package at ${tsLocal}.`, { cause: error });
  }
  if (typeof packageJson.name !== "string") {
    throw new Error(`The package at ${tsLocal} does not have a valid name.`);
  }

  const localRequire = createRequire(packageJsonPath);
  try {
    const versionModule = localRequire(packageJson.name) as {
      readonly version?: unknown;
      readonly versionMajorMinor?: unknown;
    };
    const version = isTypeScript7Version(versionModule.version)
      ? versionModule.version
      : versionModule.versionMajorMinor;
    if (!isTypeScript7Version(version)) {
      throw new Error(`The package reports an unsupported TypeScript version: ${String(version)}.`);
    }
    return {
      kind: "typescript7",
      apiPath: localRequire.resolve(`${packageJson.name}/unstable/sync`),
      astPath: localRequire.resolve(`${packageJson.name}/unstable/ast`),
      version,
    };
  } catch (error) {
    throw new Error(`The package at ${tsLocal} is not a usable TypeScript 7 package.`, { cause: error });
  }
}

function isTypeScript7Version(version: unknown): version is string {
  if (typeof version !== "string") {
    return false;
  }
  const major = /^(\d+)(?:\.|$)/.exec(version)?.[1];
  return major !== undefined && Number.parseInt(major, 10) >= 7;
}

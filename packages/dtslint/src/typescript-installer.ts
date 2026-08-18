import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export type TsVersion = TypeScriptVersion | "local";

export type LocalTypeScript =
  | { readonly kind: "legacy"; readonly compilerPath: string }
  | { readonly kind: "native"; readonly executablePath: string; readonly version: string };

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
    const version = tryGetNativeTypeScriptVersion(tsLocal);
    if (version) {
      return { kind: "native", executablePath: tsLocal, version };
    }
    throw new Error(`The file at ${tsLocal} is not a TypeScript compiler library or native executable.`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`The TypeScript build path ${tsLocal} is not a file or directory.`);
  }

  const compilerPath = path.join(tsLocal, "typescript.js");
  if (fs.existsSync(compilerPath) && fs.statSync(compilerPath).isFile()) {
    return { kind: "legacy", compilerPath };
  }

  const nativeExecutables = fs
    .readdirSync(tsLocal)
    .map((name) => path.join(tsLocal, name))
    .filter(isExecutableFile)
    .flatMap((executablePath) => {
      const version = tryGetNativeTypeScriptVersion(executablePath);
      return version ? [{ kind: "native" as const, executablePath, version }] : [];
    });

  if (nativeExecutables.length === 1) {
    return nativeExecutables[0];
  }
  if (nativeExecutables.length > 1) {
    throw new Error(`Found multiple TypeScript native executables in ${tsLocal}. Pass the intended executable path.`);
  }
  throw new Error(`Could not find a TypeScript compiler library or native executable in ${tsLocal}.`);
}

function isExecutableFile(filePath: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) {
    return false;
  }
  return process.platform === "win32" ? path.extname(filePath).toLowerCase() === ".exe" : (stat.mode & 0o111) !== 0;
}

function tryGetNativeTypeScriptVersion(executablePath: string): string | undefined {
  try {
    const output = execFileSync(executablePath, ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    });
    const version = /^Version\s+(\d+\.\d+(?:\.\d+)?(?:-[^\s]+)?)/m.exec(output)?.[1];
    return version && Number.parseInt(version, 10) >= 7 ? version : undefined;
  } catch {
    return undefined;
  }
}

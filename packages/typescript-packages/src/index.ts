import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

const versionSet = new Set(TypeScriptVersion.supported);

export function resolve(version: TypeScriptVersion) {
  if (!versionSet.has(version)) {
    throw new Error(`Unknown TypeScript version ${version}`);
  }
  return require.resolve(`typescript-${version}`);
}

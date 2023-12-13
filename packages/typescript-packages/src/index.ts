import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

export function resolve(version: TypeScriptVersion) {
  return require.resolve(`typescript-${version}`);
}

import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

export function resolve(version: TypeScriptVersion, subpath?: string) {
  return require.resolve(`typescript-${version}${subpath ? `/${subpath}` : ""}`);
}

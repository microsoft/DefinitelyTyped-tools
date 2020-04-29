import assert from "assert";

/*

  # How to add new version of Typescript #

  For the RC:

  1. Add a new version to the end of `TypeScriptVersion` and `supported`.
  2. Update failing tests.
  3. Publish and update dependents. Outside the monorepo, current dependents are dtslint, dts-critic and dt-retag.
  4. Run dt-retag.

  For the release:

  1. Move the newly-released version from `supported` to `shipped`.
  2. Update failing tests.
  3. Publish and update dependents. (dtslint, dts-critic and dt-retag)

  # How to deprecate versions on Definitely Typed #

  1. Move versions from `TypeScriptVersion` to `UnsupportedTypeScriptVersion`.
  2. Move versions from `shipped` to `unsupported`.
  4. Update failing tests.
  5. Publish and update dependents. (dtslint, dts-critic and dt-retag)

*/

/** Parseable but unsupported TypeScript versions. */
export type UnsupportedTypeScriptVersion = "2.0" | "2.1" | "2.2" | "2.3" | "2.4" | "2.5" | "2.6" | "2.7" | "2.8";
/**
 * Parseable and supported TypeScript versions.
 * Only add to this list if we will support this version on DefinitelyTyped.
 */
export type TypeScriptVersion =
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
  | "3.9"
  | "4.0";

export type AllTypeScriptVersion = UnsupportedTypeScriptVersion | TypeScriptVersion;

export namespace TypeScriptVersion {
  /** Add to this list when a version actual ships.  */
  export const shipped: readonly TypeScriptVersion[] = [
    "2.9",
    "3.0",
    "3.1",
    "3.2",
    "3.3",
    "3.4",
    "3.5",
    "3.6",
    "3.7",
    "3.8"
  ];
  /** Add to this list when a version is available as typescript@next */
  export const supported: readonly TypeScriptVersion[] = [...shipped, "3.9", "4.0"];
  /** Add to this list when it will no longer be supported on Definitely Typed */
  export const unsupported: readonly UnsupportedTypeScriptVersion[] = [
    "2.0",
    "2.1",
    "2.2",
    "2.3",
    "2.4",
    "2.5",
    "2.6",
    "2.7",
    "2.8"
  ];
  export const all: readonly AllTypeScriptVersion[] = [...unsupported, ...supported];
  export const lowest = supported[0];
  /** Latest version that may be specified in a `// TypeScript Version:` header. */
  export const latest = supported[supported.length - 1];

  export function isSupported(v: AllTypeScriptVersion): v is TypeScriptVersion {
    return supported.indexOf(v as TypeScriptVersion) > -1;
  }

  export function range(min: TypeScriptVersion): readonly TypeScriptVersion[] {
    return supported.filter(v => v >= min);
  }

  /** List of NPM tags that should be changed to point to the latest version. */
  export function tagsToUpdate(v: TypeScriptVersion): readonly string[] {
    const idx = supported.indexOf(v);
    assert(idx !== -1);
    return supported
      .slice(idx)
      .map(v => "ts" + v)
      .concat("latest");
  }

  export function previous(v: TypeScriptVersion): TypeScriptVersion | undefined {
    const index = supported.indexOf(v);
    assert(index !== -1);
    return index === 0 ? undefined : supported[index - 1];
  }

  export function isRedirectable(v: TypeScriptVersion): boolean {
    return all.indexOf(v) >= all.indexOf("3.1");
  }

  export function isTypeScriptVersion(str: string): str is TypeScriptVersion {
    return all.includes(str as TypeScriptVersion);
  }
}

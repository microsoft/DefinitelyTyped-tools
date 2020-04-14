import assert from "assert";

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

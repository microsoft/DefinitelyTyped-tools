import * as semver from "semver";

// Based on TypeScript's scanner.ts.
const expectErrorSingleLine = /^\/\/\/?\s*@ts-expect-error\s+(.*)/;
const expectErrorMultiLine = /^(?:\/|\*)*\s*@ts-expect-error\s+(.*)/;

export function isVersionedExpectErrorOutsideRange(text: string, version: string): boolean {
  const match = text.match(expectErrorSingleLine) || text.match(expectErrorMultiLine);
  if (!match) {
    return false;
  }

  try {
    const normalizedVersion = semver.coerce(version);
    const range = semver.validRange(match[1].trim());
    return normalizedVersion && range ? !semver.satisfies(normalizedVersion.version, range) : false;
  } catch {
    return false;
  }
}

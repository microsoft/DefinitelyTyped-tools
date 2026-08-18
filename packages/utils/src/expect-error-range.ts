import * as semver from "semver";

const expectErrorToken = "@ts-expect-error";

export function isVersionedExpectErrorOutsideRange(text: string, version: string): boolean {
  const rangeText = getExpectErrorRange(text);
  if (!rangeText) {
    return false;
  }

  try {
    const normalizedVersion = semver.coerce(version);
    const range = semver.validRange(rangeText);
    return normalizedVersion && range ? !semver.satisfies(normalizedVersion.version, range) : false;
  } catch {
    return false;
  }
}

function getExpectErrorRange(text: string): string | undefined {
  let comment = text.trim();
  let contentStart = 0;
  while (comment[contentStart] === "/" || comment[contentStart] === "*") {
    contentStart++;
  }
  comment = comment.slice(contentStart).trimStart();
  if (!comment.startsWith(expectErrorToken)) {
    return undefined;
  }

  let range = comment.slice(expectErrorToken.length);
  if (range.length === range.trimStart().length) {
    return undefined;
  }
  range = range.trim();
  if (range.endsWith("*/")) {
    range = range.slice(0, -2).trimEnd();
  }
  return range || undefined;
}

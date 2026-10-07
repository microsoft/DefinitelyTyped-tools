import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVersionedExpectErrorOutsideRange } from "../index";

describe(isVersionedExpectErrorOutsideRange.name, () => {
  it("normalizes TypeScript major-minor versions before evaluating ranges", () => {
    assert.equal(isVersionedExpectErrorOutsideRange("// @ts-expect-error >=7.0", "7.1"), false);
    assert.equal(isVersionedExpectErrorOutsideRange("// @ts-expect-error >=7.1", "7.0"), true);
  });

  it("does not suppress diagnostics for invalid ranges", () => {
    assert.equal(isVersionedExpectErrorOutsideRange("// @ts-expect-error not a range", "7.1"), false);
  });

  it("excludes multiline comment delimiters from the range", () => {
    assert.equal(isVersionedExpectErrorOutsideRange("/* @ts-expect-error <7.0 */", "7.0"), true);
    assert.equal(isVersionedExpectErrorOutsideRange("/* @ts-expect-error <7.0 */", "6.0"), false);
    assert.equal(isVersionedExpectErrorOutsideRange("/** @ts-expect-error <7.0 */", "7.0"), true);
  });
});

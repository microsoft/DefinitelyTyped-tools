import { isVersionedExpectErrorOutsideRange } from "../src";

describe(isVersionedExpectErrorOutsideRange.name, () => {
  it("normalizes TypeScript major-minor versions before evaluating ranges", () => {
    expect(isVersionedExpectErrorOutsideRange("// @ts-expect-error >=7.0", "7.1")).toBe(false);
    expect(isVersionedExpectErrorOutsideRange("// @ts-expect-error >=7.1", "7.0")).toBe(true);
  });

  it("does not suppress diagnostics for invalid ranges", () => {
    expect(isVersionedExpectErrorOutsideRange("// @ts-expect-error not a range", "7.1")).toBe(false);
  });

  it("excludes multiline comment delimiters from the range", () => {
    expect(isVersionedExpectErrorOutsideRange("/* @ts-expect-error <7.0 */", "7.0")).toBe(true);
    expect(isVersionedExpectErrorOutsideRange("/* @ts-expect-error <7.0 */", "6.0")).toBe(false);
    expect(isVersionedExpectErrorOutsideRange("/** @ts-expect-error <7.0 */", "7.0")).toBe(true);
  });
});

import { formatDiff } from "../../src/github/createTable";
import { SignificanceLevel } from "../../src/analysis";

describe("github", () => {
  describe("createTable", () => {
    describe("formatDiff", () => {
      it("returns an empty string when diff is not representable", () => {
        expect(formatDiff(Number.POSITIVE_INFINITY, SignificanceLevel.Alert)).toBe("");
        expect(formatDiff(Number.NaN, SignificanceLevel.Alert)).toBe("");
      });
    });
  });
});

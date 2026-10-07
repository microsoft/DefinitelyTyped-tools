import { assertDefined, deepEquals } from "../src/assertions";

describe("assertions", () => {
  describe("assertDefined", () => {
    it("returns defined values", () => {
      expect(assertDefined(0)).toBe(0);
      expect(assertDefined(null)).toBeNull();
    });

    it("throws for undefined values with a string message", () => {
      expect(() => assertDefined(undefined, "Missing value")).toThrow("Missing value");
    });

    it("preserves error messages", () => {
      const error = new Error("Missing value");
      expect(() => assertDefined(undefined, error)).toThrow(error);
    });

    it("throws for undefined values without a message", () => {
      expect(() => assertDefined(undefined)).toThrow();
    });
  });

  describe("deepEquals", () => {
    it("correctly handles expected === null", () => {
      deepEquals(null, { a: 1 });
    });
    it("correctly handles expected === undefined", () => {
      deepEquals(undefined, { a: 1 });
    });
    it("correctly handles actual === null", () => {
      deepEquals({ a: 1 }, null);
    });
    it("correctly handles actual === undefined", () => {
      deepEquals({ a: 1 }, undefined);
    });
  });
});

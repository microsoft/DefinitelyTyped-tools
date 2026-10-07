import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDefined, deepEquals } from "../assertions";

describe("assertions", () => {
  describe("assertDefined", () => {
    it("returns defined values", () => {
      assert.equal(assertDefined(0), 0);
      assert.equal(assertDefined(null), null);
    });

    it("throws for undefined values with a string message", () => {
      assert.throws(() => assertDefined(undefined, "Missing value"), /Missing value/);
    });

    it("preserves error messages", () => {
      const error = new Error("Missing value");
      assert.throws(() => assertDefined(undefined, error), error);
    });

    it("throws for undefined values without a message", () => {
      assert.throws(() => assertDefined(undefined));
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

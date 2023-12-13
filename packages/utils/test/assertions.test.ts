import { deepEquals } from "../src/assertions";

describe("assertions", () => {
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

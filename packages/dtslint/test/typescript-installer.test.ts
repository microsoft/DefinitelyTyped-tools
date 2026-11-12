/// <reference types="jest" />
import { typeScriptPath } from "../src/typescript-installer";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

describe("typescript-installer", () => {
  describe("typeScriptPath", () => {
    it("returns local path with /typescript.js appended when version is 'local'", () => {
      const result = typeScriptPath("local", "/my/local/ts");
      expect(result).toBe("/my/local/ts/typescript.js");
    });

    it("returns resolved path for a supported TypeScript version", () => {
      const version = TypeScriptVersion.supported[0];
      const result = typeScriptPath(version, undefined);
      // Should return a path resolved by typeScriptPackages
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns the same result as typeScriptPackages.resolve for non-local versions", () => {
      const version = TypeScriptVersion.latest;
      const expected = typeScriptPackages.resolve(version);
      const result = typeScriptPath(version, undefined);
      expect(result).toBe(expected);
    });
  });
});

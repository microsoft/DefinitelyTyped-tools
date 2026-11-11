import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { isAlreadyDeprecated } from "../calculate-versions";

describe("isAlreadyDeprecated", () => {
  const shouldSkip = !process.env.GITHUB_ACTIONS;

  (shouldSkip ? it.skip : it)("should report @types/commander as deprecated", async () => {
    const pkg = new NotNeededPackage("@types/commander", "commander", "2.12.2");
    const result = await isAlreadyDeprecated(pkg, { info: () => {}, error: () => {} });
    assert.equal(!!result, true);
  });
});

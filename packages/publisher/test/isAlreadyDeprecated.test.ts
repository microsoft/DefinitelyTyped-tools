import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { isAlreadyDeprecated } from "../src/calculate-versions";

describe("isAlreadyDeprecated", () => {
  const shouldSkip = !process.env.CI;

  (shouldSkip ? it.skip : it)("should report @types/commander as deprecated", async () => {
    const pkg = new NotNeededPackage("@types/commander", "commander", "2.12.2");
    const result = await isAlreadyDeprecated(pkg, { info: () => {}, error: () => {} });
    expect(!!result).toBe(true);
  });
});

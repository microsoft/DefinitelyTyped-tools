import * as util from "util";
import { NotNeededPackage } from "@definitelytyped/definitions-parser";
import { fetchIncipientStubVersion } from "../src/calculate-versions";

jest.mock("pacote", () => ({
  async packument(spec: string) {
    switch (spec) {
      case "@types/not-needed": // A not-needed @types package about to be deprecated.
        return {
          "dist-tags": { latest: "1.0.1" },
          versions: { "1.0.0": {}, "1.0.1": {} },
        };
      case "@types/bad-publish": // A not-needed package after a bad publish.
        return {
          "dist-tags": { latest: "1.2.3" },
          versions: { "1.0.0": {}, "1.0.1": {}, "1.2.3": {} },
        };
      case "@types/already-deprecated": // A successfully deprecated not-needed stub package.
        return {
          "dist-tags": { latest: "1.2.3" },
          versions: { "1.0.0": {}, "1.0.1": {}, "1.2.3": { deprecated: "Contains built-in declarations." } },
        };
    }
    throw new Error(`Unexpected npm registry fetch: ${util.inspect(spec)}`);
  },
}));

const notNeeded = new NotNeededPackage("not-needed", "not-needed", "1.2.3");
const badPublish = new NotNeededPackage("bad-publish", "bad-publish", "1.2.3");
const alreadyDeprecated = new NotNeededPackage("already-deprecated", "already-deprecated", "1.2.3");

const log = { info() {}, error() {} };

test("Returns the not-needed version", () => {
  return expect(fetchIncipientStubVersion(notNeeded, log)).resolves.toBe("1.2.3");
});

test("Skips bad publishes", () => {
  return expect(fetchIncipientStubVersion(badPublish, log)).resolves.toBe("1.2.4");
});

test("Ignores already-deprecated packages", () => {
  return expect(fetchIncipientStubVersion(alreadyDeprecated, log)).resolves.toBeUndefined();
});

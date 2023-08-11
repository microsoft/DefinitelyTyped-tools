import * as util from "util";
import { TypingsData } from "@definitelytyped/definitions-parser";
import * as pacote from "pacote";
import { fetchTypesPackageVersionInfo } from "../src/";

jest.mock("pacote", () => ({
  async manifest(spec: string, opts: pacote.Options) {
    switch (spec) {
      case "@types/already-published@~1.2": // An already-published @types package.
        return { version: "1.2.3", typesPublisherContentHash: "already-published-content-hash" };
      case "@types/first-publish@~1.2": // A new, not-yet-published @types package.
        // eslint-disable-next-line no-throw-literal
        throw { code: opts.offline ? "ENOTCACHED" : "E404" };
    }
    throw new Error(`Unexpected npm registry fetch: ${util.inspect(spec)}`);
  },
}));

const unchanged = new TypingsData(
  {
    typingsPackageName: "already-published",
    libraryMajorVersion: 1,
    libraryMinorVersion: 2,
    contentHash: "already-published-content-hash",
  } as never,
  /*isLatest*/ true
);
const changed = new TypingsData(
  {
    typingsPackageName: "already-published",
    libraryMajorVersion: 1,
    libraryMinorVersion: 2,
    contentHash: "changed-content-hash",
  } as never,
  /*isLatest*/ true
);
const firstPublish = new TypingsData(
  {
    typingsPackageName: "first-publish",
    libraryMajorVersion: 1,
    libraryMinorVersion: 2,
    contentHash: "first-publish-content-hash",
  } as never,
  /*isLatest*/ true
);

test("Increments already-published patch version", () => {
  return expect(fetchTypesPackageVersionInfo(changed)).resolves.toEqual({
    maxVersion: "1.2.3",
    incipientVersion: "1.2.4",
  });
});

test("Doesn't increment unchanged @types package version", () => {
  return expect(fetchTypesPackageVersionInfo(unchanged)).resolves.toEqual({
    maxVersion: "1.2.3",
  });
});

test("First-publish version", () => {
  return expect(fetchTypesPackageVersionInfo(firstPublish)).resolves.toEqual({
    incipientVersion: "1.2.0",
  });
});

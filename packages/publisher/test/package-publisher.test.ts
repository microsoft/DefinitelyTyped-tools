import { NotNeededPackage, TypingsData, createMockDT } from "@definitelytyped/definitions-parser";
import * as libpub from "libnpmpublish";
import { publishNotNeededPackage, publishTypingsPackage } from "../src/lib/package-publisher";

jest.mock("libnpmpublish");
jest.mock("pacote", () => ({ async manifest() {}, async tarball() {} }));

const client = { async tag() {} };

const dt = createMockDT();

const latestVersion = {
  pkg: new TypingsData(dt.fs, { header: { name: "@types/some-package" } } as never, /*isLatest*/ true),
  version: "1.2.3",
};
const oldVersion = {
  pkg: new TypingsData(dt.fs, { header: { name: "@types/some-package" } } as never, /*isLatest*/ false),
  version: "1.2.3",
};
const notNeeded = new NotNeededPackage("not-needed", "not-needed", "1.2.3");

function log() {}

test("Latest version gets latest tag", async () => {
  await publishTypingsPackage(client as never, latestVersion, /*token*/ "", /*dry*/ false, log);
  expect(libpub.publish).toHaveBeenLastCalledWith(/*manifest*/ undefined, /*tarData*/ undefined, {
    defaultTag: "latest",
    access: "public",
    token: "",
  });
});

test("Publishing old versions doesn't change the latest tag", async () => {
  await publishTypingsPackage(client as never, oldVersion, /*token*/ "", /*dry*/ false, log);
  expect(libpub.publish).toHaveBeenLastCalledWith(/*manifest*/ undefined, /*tarData*/ undefined, {
    defaultTag: "",
    access: "public",
    token: "",
  });
});

test("Not-needed package gets latest tag", async () => {
  await publishNotNeededPackage(notNeeded, /*token*/ "", /*dry*/ false, log);
  expect(libpub.publish).toHaveBeenLastCalledWith(/*manifest*/ undefined, /*tarData*/ undefined, {
    defaultTag: "latest",
    access: "public",
    token: "",
  });
});

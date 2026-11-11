import assert from "node:assert/strict";
import {
  AllPackages,
  DTMock,
  NotNeededPackage,
  TypingsData,
  TypingsDataRaw,
} from "@definitelytyped/definitions-parser";
import { License } from "@definitelytyped/header-parser";
import { createNotNeededPackageJSON, createPackageJSON, createReadme, getLicenseFileText } from "../generate-packages";
import { testo } from "./utils";

function createRawPackage(license: License): TypingsDataRaw {
  return {
    header: {
      name: "@types/jquery",
      owners: [
        { name: "A", url: "b@c.d" },
        { name: "E", githubUsername: "e" },
      ],
      libraryMajorVersion: 1,
      libraryMinorVersion: 0,
      minimumTypeScriptVersion: "3.2",
      projects: ["jquery.org"],
      nonNpm: false,
      tsconfigs: ["tsconfig.json"],
    },
    typesVersions: [],
    license,
    dependencies: { "@types/madeira": "^1" },
    peerDependencies: { "@types/express": "*" },
    devDependencies: { "@types/jquery": "workspace:." },
    olderVersionDirectories: [],
  };
}

function createUnneededPackage() {
  return new NotNeededPackage("absalom", "alternate", "1.1.1");
}

function defaultFS() {
  const dt = new DTMock();
  dt.pkgDir("jquery")
    .set(
      "package.json",
      JSON.stringify(
        {
          private: true,
          name: "@types/jquery",
          version: "1.0.9999",
          projects: ["jquery.org"],
          owners: [
            { name: "A", url: "b@c.d" },
            { name: "E", githubUsername: "e" },
          ],
          dependencies: { "@types/madeira": "^1" },
          peerDependencies: { "@types/express": "*" },
          devDependencies: { "@types/jquery": "workspace:." },
        },
        undefined,
        4,
      ),
    )
    .set("tsconfig.json", `{ "files": ["index.d.ts", "jquery-tests.ts"] }`)
    .set("index.d.ts", `type T = import("./types");\n`)
    .set("jquery-tests.ts", "// tests");
  return dt;
}

const now = new Date(1733775005612);

testo({
  mitLicenseText(t) {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.MIT), /*isLatest*/ true);
    t.assert.snapshot(getLicenseFileText(typing, now));
  },
  apacheLicenseText(t) {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    t.assert.snapshot(getLicenseFileText(typing, now));
  },
  readmeJquery(t) {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    t.assert.snapshot(createReadme(typing, dt.pkgFS("jquery"), now));
  },
  readmeMultipleDependencies(t) {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    typing.dependencies["@types/example"] = "*";
    typing.peerDependencies["@types/example2"] = "*";
    t.assert.snapshot(createReadme(typing, dt.pkgFS("jquery"), now));
  },
  readmeContainsManyDTSFilesDoesNotAmendREADME(t) {
    const rawPkg = createRawPackage(License.Apache20);
    const dt = defaultFS();
    dt.pkgDir("jquery").set("other.d.ts", "");
    const typing = new TypingsData(dt.fs, rawPkg, /*isLatest*/ true);
    t.assert.snapshot(createReadme(typing, dt.fs, now));
  },
  basicPackageJson(t) {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.MIT), /*isLatest*/ true);
    t.assert.snapshot(createPackageJSON(typing, "1.0"));
  },
  basicNotNeededPackageJson(t) {
    const s = createNotNeededPackageJSON(createUnneededPackage());
    t.assert.snapshot(s);
  },
  scopedNotNeededPackageJson(t) {
    const scopedUnneeded = new NotNeededPackage("google-cloud__pubsub", "@google-cloud/chubdub", "0.26.0");
    const s = createNotNeededPackageJSON(scopedUnneeded);
    t.assert.snapshot(s);
  },
  async versionedPackage() {
    const dt = defaultFS();
    dt.addOldVersionOfPackage("jquery", "0", "0.0.9999");
    dt.pkgDir("jquery")
      .subdir("v0")
      .set("index.d.ts", "import {} from './only-in-v0';")
      .set("only-in-v0.d.ts", "export const x: number;");
    const allPackages = AllPackages.fromFS(dt.fs);
    const typing = await allPackages.getTypingsData({ name: "@types/jquery", version: { major: 0 } })!;
    assert.ok(typing.getFiles().includes("only-in-v0.d.ts"));
    assert.ok(typing.getContentHash()); // used to crash
  },
});

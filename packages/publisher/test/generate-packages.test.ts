import {
  AllPackages,
  DTMock,
  NotNeededPackage,
  TypingsData,
  TypingsDataRaw,
} from "@definitelytyped/definitions-parser";
import { License } from "@definitelytyped/header-parser";
import {
  createNotNeededPackageJSON,
  createPackageJSON,
  createReadme,
  getLicenseFileText,
} from "../src/generate-packages";
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

testo({
  mitLicenseText() {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.MIT), /*isLatest*/ true);
    expect(getLicenseFileText(typing)).toEqual(expect.stringContaining("MIT License"));
  },
  apacheLicenseText() {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(getLicenseFileText(typing)).toEqual(expect.stringContaining("Apache License, Version 2.0"));
  },
  basicReadme() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, dt.pkgFS("jquery"))).toEqual(
      expect.stringContaining("This package contains type definitions for"),
    );
  },
  readmeContainsContributors() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, dt.pkgFS("jquery"))).toEqual(
      expect.stringContaining("written by [A](b@c.d), and [E](https://github.com/e)"),
    );
  },
  readmeContainsProjectName() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, dt.pkgFS("jquery"))).toEqual(expect.stringContaining("jquery.org"));
  },
  readmeOneDependency() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, dt.pkgFS("jquery"))).toEqual(
      expect.stringContaining("Dependencies: [@types/madeira](https://npmjs.com/package/@types/madeira)"),
    );
  },
  readmeMultipleDependencies() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    typing.dependencies["@types/example"] = "*";
    expect(createReadme(typing, dt.pkgFS("jquery"))).toEqual(
      expect.stringContaining(
        "Dependencies: [@types/example](https://npmjs.com/package/@types/example), [@types/madeira](https://npmjs.com/package/@types/madeira)",
      ),
    );
  },
  readmeContainsSingleFileDTS() {
    const dt = defaultFS();
    const typing = new TypingsData(dt.fs, createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, dt.pkgFS("jquery"))).toContain("type T = import");
  },
  readmeContainsManyDTSFilesDoesNotAmendREADME() {
    const rawPkg = createRawPackage(License.Apache20);
    const dt = defaultFS();
    dt.pkgDir("jquery").set("other.d.ts", "");
    const typing = new TypingsData(dt.fs, rawPkg, /*isLatest*/ true);
    expect(createReadme(typing, dt.fs)).not.toContain("type T = import");
  },
  basicPackageJson() {
    const typing = new TypingsData(defaultFS().fs, createRawPackage(License.MIT), /*isLatest*/ true);
    expect(createPackageJSON(typing, "1.0")).toEqual(`{
    "name": "@types/jquery",
    "version": "1.0",
    "description": "TypeScript definitions for jquery",
    "homepage": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/jquery",
    "license": "MIT",
    "contributors": [
        {
            "name": "A",
            "url": "b@c.d"
        },
        {
            "name": "E",
            "githubUsername": "e",
            "url": "https://github.com/e"
        }
    ],
    "main": "",
    "types": "index.d.ts",
    "repository": {
        "type": "git",
        "url": "https://github.com/DefinitelyTyped/DefinitelyTyped.git",
        "directory": "types/jquery"
    },
    "scripts": {},
    "dependencies": {
        "@types/madeira": "^1"
    },
    "typesPublisherContentHash": "05febc04df55db2687c2ac05a291177c2f4fd90f76d679faaf1b01896fe5600c",
    "typeScriptVersion": "4.8"
}`);
  },
  basicNotNeededPackageJson() {
    const s = createNotNeededPackageJSON(createUnneededPackage());
    expect(s).toEqual(`{
    "name": "@types/absalom",
    "version": "1.1.1",
    "description": "Stub TypeScript definitions entry for alternate, which provides its own types definitions",
    "main": "",
    "scripts": {},
    "license": "MIT",
    "dependencies": {
        "alternate": "*"
    },
    "deprecated": "This is a stub types definition. alternate provides its own type definitions, so you do not need this installed."
}`);
  },
  scopedNotNeededPackageJson() {
    const scopedUnneeded = new NotNeededPackage("google-cloud__pubsub", "@google-cloud/chubdub", "0.26.0");
    const s = createNotNeededPackageJSON(scopedUnneeded);
    expect(s).toEqual(`{
    "name": "@types/google-cloud__pubsub",
    "version": "0.26.0",
    "description": "Stub TypeScript definitions entry for @google-cloud/chubdub, which provides its own types definitions",
    "main": "",
    "scripts": {},
    "license": "MIT",
    "dependencies": {
        "@google-cloud/chubdub": "*"
    },
    "deprecated": "This is a stub types definition. @google-cloud/chubdub provides its own type definitions, so you do not need this installed."
}`);
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
    expect(typing.getFiles()).toContain("only-in-v0.d.ts");
    expect(typing.getContentHash()).toBeTruthy(); // used to crash
  },
});

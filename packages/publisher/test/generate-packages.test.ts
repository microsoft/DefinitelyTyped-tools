import {
  createNotNeededPackageJSON,
  createPackageJSON,
  createReadme,
  getLicenseFileText,
} from "../src/generate-packages";
import {
  AllPackages,
  License,
  NotNeededPackage,
  readNotNeededPackages,
  TypesDataFile,
  TypingsData,
  TypingsDataRaw,
  createMockDT,
} from "@definitelytyped/definitions-parser";
import { testo } from "./utils";
import { Registry, InMemoryFS, Dir, FS } from "@definitelytyped/utils";

function createRawPackage(license: License): TypingsDataRaw {
  return {
    libraryName: "jquery",
    typingsPackageName: "jquery",
    dependencies: { madeira: { major: 1 } },
    testDependencies: [],
    pathMappings: {},
    contributors: [{ name: "A", url: "b@c.d", githubUsername: "e" }],
    libraryMajorVersion: 1,
    libraryMinorVersion: 0,
    minTsVersion: "3.2",
    typesVersions: [],
    files: ["index.d.ts", "jquery.test.ts"],
    license,
    packageJsonDependencies: [{ name: "balzac", version: "~3" }],
    contentHash: "11",
    projectName: "jquery.org",
    globals: [],
    declaredModules: ["jquery"],
  };
}
function createTypesData(): TypesDataFile {
  return {
    jquery: {
      "1.0": createRawPackage(License.MIT),
    },
    madeira: {
      "1.0": createRawPackage(License.Apache20),
    },
  };
}
function createUnneededPackage() {
  return new NotNeededPackage("absalom", "alternate", "1.1.1");
}

function defaultFS(): FS {
  const pkg = new Dir(undefined);
  pkg.set(
    "index.d.ts",
    `type T = import("./types");
`
  );
  pkg.set("jquery.test.ts", "// tests");
  const memFS = new InMemoryFS(pkg, "/types/mock/");
  return memFS;
}

testo({
  mitLicenseText() {
    const typing = new TypingsData(createRawPackage(License.MIT), /*isLatest*/ true);
    expect(getLicenseFileText(typing)).toEqual(expect.stringContaining("MIT License"));
  },
  apacheLicenseText() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(getLicenseFileText(typing)).toEqual(expect.stringContaining("Apache License, Version 2.0"));
  },
  basicReadme() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).toEqual(
      expect.stringContaining("This package contains type definitions for")
    );
  },
  readmeContainsProjectName() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).toEqual(expect.stringContaining("jquery.org"));
  },
  readmeOneDependency() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).toEqual(
      expect.stringContaining("Dependencies: [@types/madeira](https://npmjs.com/package/@types/madeira)")
    );
  },
  readmeMultipleDependencies() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    // @ts-expect-error - dependencies is readonly
    typing.dependencies.example = { major: 2 };
    expect(createReadme(typing, defaultFS())).toEqual(
      expect.stringContaining(
        "Dependencies: [@types/example](https://npmjs.com/package/@types/example), [@types/madeira](https://npmjs.com/package/@types/madeira)"
      )
    );
  },
  readmeContainsSingleFileDTS() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).toContain("type T = import");
  },
  readmeContainsManyDTSFilesDoesNotAmendREADME() {
    const rawPkg = createRawPackage(License.Apache20);
    // @ts-expect-error - files is readonly
    rawPkg.files = ["index.d.ts", "other.d.ts"];
    const typing = new TypingsData(rawPkg, /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).not.toContain("type T = import");
  },
  readmeNoGlobals() {
    const typing = new TypingsData(createRawPackage(License.Apache20), /*isLatest*/ true);
    expect(createReadme(typing, defaultFS())).toEqual(expect.stringContaining("Global values: none"));
  },
  basicPackageJson() {
    const packages = AllPackages.from(createTypesData(), readNotNeededPackages(createMockDT().fs));
    const typing = new TypingsData(createRawPackage(License.MIT), /*isLatest*/ true);
    expect(createPackageJSON(typing, "1.0", packages)).toEqual(`{
    "name": "@types/jquery",
    "version": "1.0",
    "description": "TypeScript definitions for jquery",
    "homepage": "https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/jquery",
    "license": "MIT",
    "contributors": [
        {
            "name": "A",
            "url": "b@c.d",
            "githubUsername": "e"
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
        "@types/madeira": "^1",
        "balzac": "~3"
    },
    "typesPublisherContentHash": "11",
    "typeScriptVersion": "4.2"
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
});

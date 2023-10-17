import * as ts from "typescript";
import { createModuleResolutionHost } from "@definitelytyped/utils";
import { DTMock, createMockDT } from "../src/mocks";
import { testo } from "./utils";
import { allReferencedFiles } from "../src/lib/module-info";

const fs = createMockDT().fs;
const moduleResolutionHost = createModuleResolutionHost(fs);
const compilerOptions = {
  module: ts.ModuleKind.Node16,
  baseUrl: "/DefinitelyTyped/types",
  typeRoots: ["/DefinitelyTyped/types"],
};

function getBoringReferences() {
  return allReferencedFiles(
    ["index.d.ts", "boring-tests.ts"],
    fs.subDir("types").subDir("boring"),
    "boring",
    moduleResolutionHost,
    compilerOptions
  );
}
testo({
  allReferencedFilesFromTsconfigFiles() {
    const { types, tests } = getBoringReferences();
    expect(Array.from(types.keys())).toEqual([
      "index.d.ts",
      "secondary.d.ts",
      "quaternary.d.ts",
      "tertiary.d.ts",
      "commonjs.d.ts",
      "v1.d.ts",
    ]);
    expect(Array.from(tests.keys())).toEqual(["boring-tests.ts"]);
  },
  allReferencedFilesFromTestIncludesSecondaryInternalFiles() {
    const { types, tests } = allReferencedFiles(
      ["boring-tests.ts"],
      fs.subDir("types").subDir("boring"),
      "boring",
      moduleResolutionHost,
      compilerOptions
    );
    expect(Array.from(types.keys())).toEqual([
      "secondary.d.ts",
      "quaternary.d.ts",
      "tertiary.d.ts",
      "commonjs.d.ts",
      "v1.d.ts",
    ]);
    expect(Array.from(tests.keys())).toEqual(["boring-tests.ts"]);
  },
  allReferencedFilesFromTsconfigGlobal() {
    const { types, tests } = allReferencedFiles(
      ["jquery-tests.ts", "index.d.ts"],
      fs.subDir("types").subDir("jquery"),
      "jquery",
      moduleResolutionHost,
      compilerOptions
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "JQuery.d.ts"]);
    expect(Array.from(tests.keys())).toEqual(["jquery-tests.ts"]);
  },
  allReferencedFilesFromTestIncludesSecondaryTripleSlashTypes() {
    const { types, tests } = allReferencedFiles(
      ["globby-tests.ts", "test/other-tests.ts"],
      fs.subDir("types").subDir("globby"),
      "globby",
      moduleResolutionHost,
      compilerOptions
    );
    expect(Array.from(types.keys())).toEqual([]);
    expect(Array.from(tests.keys())).toEqual(["globby-tests.ts", "test/other-tests.ts"]);
  },
  allReferencedFilesIncludesTypesImports() {
    const dtMock = new DTMock();
    const pkg = dtMock.pkgDir("mock");
    pkg.set(
      "index.d.ts",
      `type T = import("./types");
`
    );
    pkg.set("types.d.ts", "");
    const { types, tests } = allReferencedFiles(
      ["index.d.ts"],
      dtMock.fs.subDir("types/mock"),
      "mock",
      createModuleResolutionHost(dtMock.fs),
      compilerOptions
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "types.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
  selfInScopedPackage() {
    const dtMock = new DTMock();
    const scoped = dtMock.pkgDir("rdfjs__to-ntriples");
    scoped.set(
      "index.d.ts",
      `import "@rdfjs/to-ntriples/component";
`
    );
    scoped.set("component.d.ts", "");
    const { types, tests } = allReferencedFiles(
      ["index.d.ts"],
      dtMock.fs.subDir("types/rdfjs__to-ntriples"),
      "rdfjs__to-ntriples",
      createModuleResolutionHost(dtMock.fs),
      { ...compilerOptions, paths: { "@rdfjs/to-ntriples/*": ["rdfjs__to-ntriples/*"] } }
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "component.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
  selfInTypesVersionsParent() {
    const dtMock = new DTMock();
    const pkg = dtMock.pkgDir("mock");
    const ts20 = pkg.subdir("ts2.0");
    ts20.set(
      "index.d.ts",
      `/// <reference path="../ts1.0/index.d.ts" />
`
    );
    ts20.set("component.d.ts", "");
    const ts10 = pkg.subdir("ts1.0");
    ts10.set(
      "index.d.ts",
      `import "mock/component";
`
    );

    const { types, tests } = allReferencedFiles(
      ["index.d.ts"],
      dtMock.fs.subDir("types/mock/ts2.0"),
      "mock",
      createModuleResolutionHost(dtMock.fs),
      { ...compilerOptions, paths: { "mock/*": ["mock/ts2.0/*"] } }
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "../ts1.0/index.d.ts", "component.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
});

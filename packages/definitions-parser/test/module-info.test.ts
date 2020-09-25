import * as ts from "typescript";
import { Dir, InMemoryFS } from "@definitelytyped/utils";
import { createMockDT } from "../src/mocks";
import { testo } from "./utils";
import { allReferencedFiles, getModuleInfo, getTestDependencies } from "../src/lib/module-info";

const fs = createMockDT().fs;
function getBoringReferences() {
  return allReferencedFiles(
    ["index.d.ts", "boring-tests.ts"],
    fs.subDir("types").subDir("boring"),
    "boring",
    "types/boring"
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
      "v1.d.ts"
    ]);
    expect(Array.from(tests.keys())).toEqual(["boring-tests.ts"]);
  },
  allReferencedFilesFromTestIncludesSecondaryInternalFiles() {
    const { types, tests } = allReferencedFiles(
      ["boring-tests.ts"],
      fs.subDir("types").subDir("boring"),
      "boring",
      "types/boring"
    );
    expect(Array.from(types.keys())).toEqual([
      "secondary.d.ts",
      "quaternary.d.ts",
      "tertiary.d.ts",
      "commonjs.d.ts",
      "v1.d.ts"
    ]);
    expect(Array.from(tests.keys())).toEqual(["boring-tests.ts"]);
  },
  allReferencedFilesFromTsconfigGlobal() {
    const { types, tests } = allReferencedFiles(
      ["jquery-tests.ts", "index.d.ts"],
      fs.subDir("types").subDir("jquery"),
      "jquery",
      "types/jquery"
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "JQuery.d.ts"]);
    expect(Array.from(tests.keys())).toEqual(["jquery-tests.ts"]);
  },
  allReferencedFilesFromTestIncludesSecondaryTripleSlashTypes() {
    const { types, tests } = allReferencedFiles(
      ["globby-tests.ts", "test/other-tests.ts"],
      fs.subDir("types").subDir("globby"),
      "globby",
      "types/globby"
    );
    expect(Array.from(types.keys())).toEqual(["merges.d.ts"]);
    expect(Array.from(tests.keys())).toEqual(["globby-tests.ts", "test/other-tests.ts"]);
  },
  allReferencedFilesIncludesTypesImports() {
    const pkg = new Dir(undefined);
    pkg.set(
      "index.d.ts",
      `type T = import("./types");
`
    );
    pkg.set("types.d.ts", "");
    const memFS = new InMemoryFS(pkg, "types/mock");
    const { types, tests } = allReferencedFiles(["index.d.ts"], memFS, "mock", "types/mock");
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "types.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
  getModuleInfoWorksWithOtherFiles() {
    const { types } = getBoringReferences();
    // written as if it were from OTHER_FILES.txt
    types.set(
      "untested.d.ts",
      ts.createSourceFile(
        "untested.d.ts",
        fs
          .subDir("types")
          .subDir("boring")
          .readFile("untested.d.ts"),
        ts.ScriptTarget.Latest,
        false
      )
    );
    const i = getModuleInfo("boring", types);
    expect(i.dependencies).toEqual(new Set(["manual", "react", "react-default", "things", "vorticon"]));
  },
  getModuleInfoForNestedTypeReferences() {
    const { types } = allReferencedFiles(
      ["index.d.ts", "globby-tests.ts", "test/other-tests.ts"],
      fs.subDir("types").subDir("globby"),
      "globby",
      "types/globby"
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "sneaky.d.ts", "merges.d.ts"]);
    const i = getModuleInfo("globby", types);
    expect(i.dependencies).toEqual(new Set(["andere"]));
  },
  versionTypeRefThrows() {
    const fail = new Dir(undefined);
    const memFS = new InMemoryFS(fail, "typeref-fails");
    fail.set(
      "index.d.ts",
      `// Type definitionssrc/ for fail 1.0
// Project: https://youtube.com/s-fails
// Definitions by: Type Ref Fails <https://github.com/typeref-fails>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="elser/v3" />
`
    );
    const { types } = allReferencedFiles(["index.d.ts"], memFS, "typeref-fails", "types/typeref-fails");
    expect(Array.from(types.keys())).toEqual(["index.d.ts"]);
    expect(() => getModuleInfo("typeref-fails", types)).toThrow(
      "do not directly import specific versions of another types package"
    );
  },
  selfVersionTypeRefAllowed() {
    const fail = new Dir(undefined);
    const memFS = new InMemoryFS(fail, "typeref-fails");
    fail.set(
      "index.d.ts",
      `// Type definitions for fail 1.0
// Project: https://youtube.com/typeref-fails
// Definitions by: Type Ref Fails <https://github.com/typeref-fails>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="fail/v3" />
`
    );
    const { types } = allReferencedFiles(["index.d.ts"], memFS, "typeref-fails", "types/typeref-fails");
    expect(Array.from(types.keys())).toEqual(["index.d.ts"]);
    const i = getModuleInfo("fail", types);
    expect(i.dependencies).toEqual(new Set([]));
  },
  selfInScopedPackage() {
    const scoped = new Dir(undefined);
    scoped.set(
      "index.d.ts",
      `import "@rdfjs/to-ntriples/component";
`
    );
    scoped.set("component.d.ts", "");
    const memFS = new InMemoryFS(scoped, "types/rdfjs__to-ntriples");
    const { types, tests } = allReferencedFiles(
      ["index.d.ts"],
      memFS,
      "rdfjs__to-ntriples",
      "types/rdfjs__to-ntriples"
    );
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "component.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
  selfInTypesVersionsParent() {
    const pkg = new Dir(undefined);
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
    const memFS = new InMemoryFS(ts20, "types/mock/ts2.0");
    const { types, tests } = allReferencedFiles(["index.d.ts"], memFS, "mock", "types/mock");
    expect(Array.from(types.keys())).toEqual(["index.d.ts", "../ts1.0/index.d.ts", "component.d.ts"]);
    expect(Array.from(tests.keys())).toEqual([]);
  },
  getTestDependenciesWorks() {
    const { types, tests } = getBoringReferences();
    const i = getModuleInfo("boring", types);
    const d = getTestDependencies("boring", types, tests.keys(), i.dependencies, fs.subDir("types").subDir("boring"));
    expect(d).toEqual(new Set(["super-big-fun-hus"]));
  }
});

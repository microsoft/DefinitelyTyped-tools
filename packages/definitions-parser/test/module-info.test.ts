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
  getTestDependenciesWorks() {
    const { types, tests } = getBoringReferences();
    const i = getModuleInfo("boring", types);
    const d = getTestDependencies("boring", types, tests.keys(), i.dependencies, fs.subDir("types").subDir("boring"));
    expect(d).toEqual(new Set(["super-big-fun-hus"]));
  }
});

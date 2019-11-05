import { Dir, InMemoryDT } from "./get-definitely-typed";
export function createMockDT() {
    const root = new Dir(undefined);
    root.set("notNeededPackages.json", `{
    "packages": [{
    "libraryName": "Angular 2",
    "typingsPackageName": "angular",
    "asOfVersion": "1.2.3",
    "sourceRepoURL": "https://github.com/angular/angular2"
  }]
}`);
    const types = root.subdir("types");
    const jquery = types.subdir("jquery");
    jquery.set("JQuery.d.ts", `
declare var jQuery: 1;
`);
    jquery.set("index.d.ts", `// Type definitions for jquery 3.3
// Project: https://jquery.com
// Definitions by: Leonard Thieu <https://github.com/leonard-thieu>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

/// <reference path="JQuery.d.ts" />

export = jQuery;
`);
    jquery.set("jquery-tests.ts", `
console.log(jQuery);
`);
    jquery.set("tsconfig.json", `{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6",
            "dom"
        ],
        "target": "es6",
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "baseUrl": "../",
        "typeRoots": [
            "../"
        ],
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
        "jquery-tests.ts"
    ]
}

`);

    return new InMemoryDT(root, "DefinitelyTyped");
}

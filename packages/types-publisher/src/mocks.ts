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
    const boring = types.subdir("boring");
    boring.set("index.d.ts", `// Type definitions for boring 1.0
// Project: https://boring.com
// Definitions by: Some Guy From Space <https://github.com/goodspaceguy420>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import * as React from 'react';
export const drills: number;
`);
    boring.set("secondary.d.ts", `
import deffo from 'react-default';
import { mammoths } from 'boring/quaternary';
export const hovercars: unknown;
declare module "boring/fake" {
    import { stock } from 'boring/tertiary';
}
declare module "other" {
    export const augmented: true;
}
`);
    boring.set("tertiary.d.ts", `
import { stuff } from 'things';
export var stock: number;
`);
    boring.set("quaternary.d.ts", `
export const mammoths: object;
`);
    boring.set("commonjs.d.ts", `
import vortex = require('vorticon');
declare const australia: {};
export = australia;
`);
    boring.set("v1.d.ts", `
export const inane: true | false;
`);
    boring.set("untested.d.ts", `
import { help } from 'manual';
export const fungible: false;
`);
    boring.set("boring-tests.ts", `
import { superstor } from "super-big-fun-hus";
import { drills } from "boring";
import { hovercars } from "boring/secondary";
import australia = require('boring/commonjs');
import { inane } from "boring/v1";
`);
    boring.set("OTHER_FILES.txt", `
untested.d.ts
`);
    boring.set("tsconfig.json", `{
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
        "boring-tests.ts"
    ]
}`);

    const globby = types.subdir("globby");
    globby.set("index.d.ts", `// Type definitions for globby 0.1
// Project: https://globby-gloopy.com
// Definitions by: The Dragon Quest Slime <https://github.com/gloopyslime>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference path="./sneaky.d.ts" />
/// <reference types="andere/snee" />
declare var x: number
`);
    globby.set("merges.d.ts", `
declare var y: number
`);
    globby.set("sneaky.d.ts", `
declare var ka: number
`);
    globby.set("globby-tests.ts", `
var z = x;
`);
    const tests = globby.subdir("test");
    tests.set("other-tests.ts", `
/// <reference types="globby/merges" />
var z = y;
`);
    globby.set("tsconfig.json", `{
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
        "globby-tests.ts",
        "test/other-tests.ts"
    ]
}`);
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

`dtslint` tests a TypeScript declaration file for style and correctness.
It will install `typescript` and `eslint` for you, so this is the only tool you need to test a type definition.

Lint rules new to dtslint are documented in the [docs](docs) directory.

# Just looking for a type testing tool?

If you are just looking for a TypeScript type testing tool, use:

- [`tsd`](https://github.com/tsdjs/tsd)
- [`eslint-plugin-expect-type`](https://github.com/JoshuaKGoldberg/eslint-plugin-expect-type)
- [`tstyche`](https://github.com/tstyche/tstyche)


# Setup

If you are working on DefinitelyTyped, read the [DefinitelyTyped README](https://github.com/DefinitelyTyped/DefinitelyTyped#readme).

If you are writing the library in TypeScript, don't use `dtslint`.
Use [`--declaration`](http://www.typescriptlang.org/docs/handbook/compiler-options.html) to have type definitions generated for you.

If you are a library author, read below.


## Add types for a library (not on DefinitelyTyped)

[`dts-gen`](https://github.com/Microsoft/dts-gen#readme) may help, but is not required.

Create a `types` directory. (Name is arbitrary.)
Add `"types": "types"` to your `package.json`.
Read more on bundling types [here](http://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html).


#### `types/index.d.ts`

Only `index.d.ts` and `package.json` need to be published to NPM. The other files will be required by Definitely Typed for testing.
Write your type definitions in `index.d.ts`.
Refer to the [handbook](http://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html) or `dts-gen`'s templates for how to do this.


#### `types/tsconfig.json`

```json5
{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6",
        ],
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
        "PACKAGE-NAME-tests.ts",
    ]
}
```

You may extend `"lib"` to, for example, `["es6", "dom"]` if you need those typings.
You may also have to add `"target": "es6"` if using certain language features.

#### `types/package.json`

```json5
{
    "private": true,
    "name": "@types/PACKAGE-NAME",
    "version": "1.2.9999",
    "projects": [
        "https://example.com/"
    ],
    "dependencies": {
        "@types/DEPENDENCY-1": "*",
        "@types/DEPENDENCY-2": "*"
    },
    "devDependencies": {
        "@types/PACKAGE-NAME": "workspace:."
    },
    "owners": [
        {
            "name": "My Self",
            "githubUsername": "ghost"
        }
    ]
}
```

1. If the types are for a scoped package, you must name-mangle `@scope/package` to `@types/scope__package`.
2. The major and minor versions should match some published version of the npm package. The patch version must be 9999; Definitely Typed will increment published patch versions starting at 0, and the patch version of the types will not match the patch version of the npm package.
3. `"projects"` is a link to the source project.
4. There might not be any dependencies if the *types* don't rely on anything but standard types.
5. `"devDependencies"` must include a self-reference like `"@types/PACKAGE-NAME": "workspace:.`. Plus any dependencies used only by tests.
6. Non-`@types` dependencies must be added to `allowedPackageJsonDependencies.txt` in the definitions-parser package. The PR must be approved by a Typescript team member.
7. If you do not have a github user name, you can provide a `"url"` of your own instead.

Also:

For types that do not have a matching NPM package, add two properties:

1. `"nonNpm": true`
2. `"nonNpmDescription"`, a human-readable name for the project that is being typed.

#### `types/.eslintrc.json`

An `.eslintrc.json` file is optional.
You can skip it if you don't need to modify any lint rule settings.
We recommend not adding an `.eslintrc.json` file.

```json5
{ "extends": "@definitelytyped/dtslint/dt.json" }
```

If present, this will override `dtslint`'s default "[`all`](https://github.com/microsoft/DefinitelyTyped-tools/blob/main/packages/eslint-plugin/src/configs/all.ts)" config.
You can specify new [lint rules](https://eslint.org/docs/latest/rules/), or disable some. An example:

```json5
{
    "rules": {
        "@definitelytyped/no-unnecessary-generics": "off"
    }
}
```

Please don't do this without a good reason.
Disabling lint rules makes a Definitely Typed PR less likely to be merged, and will definitely take longer to review.


#### `types/test.ts`

You can have any number of test files you want, with any names. See below on what to put in them.

## Write tests

A test file should be a piece of sample code that tests using the library. Tests are type-checked, but not run.
To assert that an expression is of a given type, use `$ExpectType`.
To assert that an expression causes a compile error, use `@ts-expect-error`.
(Assertions will be checked by the `expect` lint rule.)

```ts
import { f } from "my-lib"; // f is(n: number) => void

// $ExpectType void
f(1);

// Can also write the assertion on the same line (but not if it's a multiline function call).
f(2); // $ExpectType void

// @ts-expect-error
f("one");
```


## Specify a TypeScript version

Normally packages will be tested according to [DefinitelyType's support window](https://github.com/DefinitelyTyped/DefinitelyTyped#support-window).
To restrict testing to new versions only, specify it in package.json:

```ts
"minimumTypeScriptVersion: 5.0"
```

This tests only 5.0 and above, although people can still depend on the package with lower versions of Typescript if they want.

## Run tests

- `npm install --save-dev @definitelytyped/dtslint`
- Add to your `package.json` `scripts`: `"dtslint": "dtslint types"`
- `npm run dtslint`

### Options

- `--localTs`

Use your locally installed version of TypeScript.

```sh
dtslint --localTs node_modules/typescript/lib types
```
- `--expectOnly`

Disable all the lint rules except the one that checks for type correctness.

```sh
dtslint --expectOnly types
```

# Contributing

## Build

```sh
npm link . # Global 'dts-lint' should now refer to this.
npm run watch
```

## Test

Use `pnpm test` to run all tests.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## FAQ
I'm getting an error about a missing typescript install.
```
Error: Cannot find module '/node_modules/dtslint/typescript-installs/3.1/node_modules/typescript`
```
Your dependencies may be out of date.
[@definitelytyped/typescript-versions](https://github.com/microsoft/DefinitelyTyped-tools/tree/main/packages/typescript-versions) is the package that contains the list of TypeScript versions to install.

Alternatively this error can be caused by concurrent dtslint invocations trampling each other's TypeScript installations, especially in the context of continuous integration, if dtslint is installed from scratch in each run.
If for example you use [Lerna](https://github.com/lerna/lerna/tree/main/commands/run#readme), try running dtslint with [`lerna --concurrency 1 run ...`](https://github.com/lerna/lerna/tree/main/core/global-options#--concurrency).

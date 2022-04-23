# dts-critic

Checks a new dts against the Javascript sources and tells you what
problems it has.

# Usage

Build the program:
```sh
$ npm run build
```

Run the program using node:
```sh
$ node dist/index.js --dts=path-to-d.ts [--js=path-to-source] [--mode=mode] [--debug]
```

If the d.ts path is to a file named `index.d.ts`, the name of the directory
will be used as the package name instead. For example
`~/dt/types/jquery/index.d.ts` will use `jquery` as the name.

`path-to-source` is optional; if you leave it off, the code will
check npm for a package with the same name as the d.ts.

## Mode

You can run dts-critic in different modes that affect which checks will be performed:
1. `name-only`: dts-critic will check your package name and [DefinitelyTyped header](../header-parser) (if present) against npm packages.
For example, if your declaration is for an npm package called 'cool-js-package', it will check if a
package named 'cool-js-package' actually exists in npm.

2. `code`: in addition to the checks performed in `name-only` mode, dts-critic will check if your
declaration exports match the source JavaScript module exports.
For example, if your declaration has a default export, it will check if the JavaScript module also
has a default export.

# Current checks

## Npm declaration
If your declaration is for an npm package:

1. An npm package with the same name of your declaration's package must exist.
2. If your declaration has a [Definitely Typed header](../header-parser)
and the header specifies a target version, the npm package must have
a matching version.
3. If you are running under `code` mode, your declaration must also match the source JavaScript module.

## Non-npm declaration
<!-- 2. If no local path to source is provided, an npm package with the
same name as the d.ts must exist. -->
If your declaration is for a non-npm package (in other words, if your declaration has a
[Definitely Typed header](../header-parser) *and*
the header specifies that the declaration file is for a non-npm package):

1. An npm package with the same name of your declaration's package **cannot** exist.
3. If you are running under `code` mode *and* a path to the JavaScript source file was provided, your
declaration must also match the source JavaScript module.

# Planned work

1. Make sure your module structure fits the source.
2. Make sure your exported symbols match the source.
3. Make sure your types match the source types???
6. Download source based on npm homepage (if it is github).

Note that for real use on Definitely Typed, a lot of these checks need to be pretty loose.

# Also

```sh
$ node dist/dt.js
```

Will run dts-critic on every directory inside `../DefinitelyTyped` and
print errors.

# Contributing

## Testing

The tests use the [Jest](https://jestjs.io/) framework. To build and execute the tests, run:

```sh
$ npm run test
```

This will build the program and run jest.

# dts-critic

Checks a new dts against the Javascript sources and tells you what
problems it has.

To use:

```sh
$ node index.js path-to-d.ts [path-to-source]
```

If the d.ts path is to a file named `index.d.ts`, the name of the directory
will be used as the package name instead. For example
`~/dt/types/jquery/index.d.ts` will use `jquery` as the name.

`path-to-source` is optional; if you leave it off, the code will
check npm for a package with the same name as the d.ts.

# Current checks


1. If no local path to source is provided, an npm package with the
same name as the d.ts must exist.
2. The d.ts and the source path must have the same name.
3. If the d.ts has a
[Definitely Typed header](https://github.com/Microsoft/definitelytyped-header-parser)
*and* npm is used to obtain the path to the source, the `homepage`
property of npm must be one of the entries in the `Project` field of
the DT header.
4. If the d.ts has a DT header and npm is used *and* the header
specifies that the d.ts is for a non-npm package, the name of the d.ts
must not conflict with an existing npm package.

# Planned work

1. Make sure your module structure fits the source.
2. Make sure your exported symbols match the source.
3. Make sure your types match the source types???
6. Download source based on npm homepage (if it is github).

Note that for real use on Definitely Typed, a lot of these checks need to be pretty loose.

# Also

```sh
$ node dt.js
```

Will run dts-critic on every directory inside `../DefinitelyTyped` and
print errors.

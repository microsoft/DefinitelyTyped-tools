# `@definitelytyped/retag`

Refresh tags on all DT-published packages in the @types scope.

Run this whenever an RC of Typescript is released.

1. `--dry` will not actually do the retag, but print what it would do.
2. `--name=X` will only retag ONE package, and is optional. This is only needed to fix types-publishers' mistakes, or to unwedge it after its cache is corrupted.

## Usage

Before running

1. Make sure that you have an up-to-date Definitely Typed repo next to the DefinitelyTyped-tools directory.
2. Make sure that the NPM_TOKEN and GH_API_TOKEN environment variables are defined.

Then, from DefinitelyTyped-tools root:

```
$ node packages/retag/dist/index.js
```


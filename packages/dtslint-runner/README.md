# @definitelytyped/dtslint-runner

A unification of [dtslint-runner](https://github.com/DefinitelyTyped/dtslint-runner) and [the CI part of types-publisher](https://github.com/microsoft/types-publisher/blob/master/src/tester/test-runner.ts).

To run locally, try:

```sh
# from DefinitelyTyped-tools root:
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path ~/DefinitelyTyped
# from DefinitelyTyped root:
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path .
# run all (from DefinitelyTyped root):
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all

# after running once, it's faster to add --noInstall
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall
# you might only want to run a fraction of packages for testing
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall --shardCount 8 --shardId 1
# or test only with the $ExpectType rule, which type checks
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall --expectOnly
# or test only with the $ExpectType rule, which type checks
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall --expectOnly
# and you might just want to test on the latest Typescript
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall --expectOnly --onlyTestTsNext
# or a local build of Typescript
$ node node_modules/@definitelytyped/dtslint-runner/dist/index.js --path . --selection all --noInstall --expectOnly --localTypeScriptPath ../ts/built/local
```


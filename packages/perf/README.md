# @definitelytyped/perf

Performance measuring utilities for [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped).

## Usage

This is not currently designed for public consumption, so docs, tests, and usage help are _very_ light. The utility is used only in Azure Pipelines for [DefinitelyTyped](https://dev.azure.com/definitelytyped/DefinitelyTyped/_build?definitionId=4) and [TypeScript](https://dev.azure.com/typescript/TypeScript/_build?definitionId=29). There are three main functions that run in CI:

1. **Every night, see what packages on DefinitelyTyped haven’t been benchmarked with the current version of TypeScript since their last change, and benchmark them.** The CLI entrypoint `getPackagesToBenchmark` queries the [Cosmos DB instance](https://ms.portal.azure.com/#@microsoft.onmicrosoft.com/resource/subscriptions/57bfeeed-c34a-4ffd-a06b-ccff27ac91b8/resourceGroups/DefinitelyTypedPerf/providers/Microsoft.DocumentDb/databaseAccounts/dt-perf/overview) to see what packages need to be benchmarked, then generates a file specifying what to run. In another phase, a large number of build agents read that file with the `benchmark` entrypoint and benchmark the packages in parallel. After a new TypeScript release, it takes several weeks of running this nightly to cover all of DefinitelyTyped.
2. **On every PR to DefinitelyTyped, pull the benchmarks for changed packages. If they haven’t been run or aren’t up-to-date, run them on `master`. Then, benchmark the PR, and compare. Post the summary of the results in a comment on the PR.** This is done with the `compare` CLI entrypoint.
3. **Every night, find existing benchmarks that have been run with the latest TypeScript version, run them with `typescript@master`, and compare.** This is done with the `compareTypeScript` CLI entrypoint. Results are uploaded to the `typeScriptComparisons` collection in the database.

The package registers a `bin` called `definitely-not-slow` upon installation:

```bash
npx definitely-not-slow compare --package react/v16 --upload false
```

## Installation and publishing

This utility isn’t published to npm; rather, a GitHub workflow produces branches that include the compiled code:

```bash
npm install github:andrewbranch/definitely-not-slow#production # Published on every tag
npm install github:andrewbranch/definitely-not-slow#beta # Published on every push to master
```

It can be useful to queue a Pipelines build manually against a real DefinitelyTyped PR with the variables `COMMENT=false` and `DNS_VERSION=beta` (definitely-not-slow—bad acronym, sorry) to test changes to definitely-not-slow on real code.

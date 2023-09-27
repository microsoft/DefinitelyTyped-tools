# DefinitelyTyped-tools

A monorepo for formerly disparate DefinitelyTyped-related tools:

- [definitions-parser](packages/definitions-parser): the part of [microsoft/types-publisher](https://github.com/microsoft/types-publisher) that reads DefinitelyTyped repository data
- [dtslint](packages/dtslint): [microsoft/dtslint](https://github.com/microsoft/dtslint)
- [dtslint-runner](packages/dtslint-runner): [DefinitelyTyped/dtslint-runner](https://github.com/DefinitelyTyped/dtslint-runner)
- [dts-critic](packages/dts-critic): [DefinitelyTyped/dts-critic](https://github.com/DefinitelyTyped/dts-critic)
- [header-parser](packages/header-parser): [microsoft/definitelytyped-header-parser](https://github.com/microsoft/definitelytyped-header-parser)
- [publisher](packages/publisher): the rest of [microsoft/types-publisher](https://github.com/microsoft/types-publisher)
- [retag](packages/retag): [DefinitelyTyped/dt-retag](https://github.com/DefinitelyTyped/dt-retag)
- [typescript-versions](packages/typescript-versions): the part of [definitelytyped-header-parser](https://github.com/microsoft/definitelytyped-header-parser) that tracked which TypeScript versions are published to npm and supported on DefinitelyTyped
- [utils](packages/utils): shared utilities, mostly extracted from [microsoft/types-publisher](https://github.com/microsoft/types-publisher)

## Disclaimer

These tools are not intended for public consumption, so we may break the API whenever convenient for us.

## Development

This is a monorepo managed with [pnpm workspaces](https://https://pnpm.io/workspaces) and published with [changesets](https://github.com/changesets/changesets). After cloning, run `pnpm install` to install dependencies for each package and link them to each other.

### Testing

All packages use [jest](https://github.com/facebook/jest), with a single configuration set up to be run from the monorepo root. `pnpm test` is an alias for `jest`, so you can run tests with any of [jest’s CLI options](https://jestjs.io/docs/en/cli). For example, to run tests for a single package:

```sh
pnpm test packages/utils
```

### Publishing/deploying

[types-publisher](./packages/publisher) runs in [GitHub Actions](./.github/workflows/publish-packages.yml) using all monorepo packages built from source on `master`.

The public packages are published to npm using [changesets](https://github.com/changesets/changesets). When making changes to any publishable package, run `pnpm changeset` (ideally as part of the related feature PR) to mark the changed packages for eventual version bumping and release. When that PR is merged, another PR will be automatically opened (or updated) updating package versions and CHANGELOGs. What _that_ PR is merged, a [workflow](./.github/workflows/version-or-publish.yml) will publish the changed packages to npm.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

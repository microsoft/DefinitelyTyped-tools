# DefinitelyTyped-tools

_✨ Under construction ✨_

A monorepo for formerly disparate DefinitelyTyped-related tools:

- [header-parser](packages/header-parser): [microsoft/definitelytyped-header-parser](https://github.com/microsoft/definitelytyped-header-parser)
- [definitions-parser](packages/definitions-parser): the part of [microsoft/types-publisher](https://github.com/microsoft/types-publisher) that reads DefinitelyTyped repository data
- [publisher](packages/publisher): the rest of [microsoft/types-publisher](https://github.com/microsoft/types-publisher)
- [utils](packages/utils): shared utilities, mostly extracted from [microsoft/types-publisher](https://github.com/microsoft/types-publisher)

## Disclaimer

These tools are not intended for public consumption, so we may break the API whenever convenient for us.

## Development

This is a monorepo managed with [lerna](https://github.com/lerna/lerna). After cloning, run `npm install`. `lerna bootstrap` will be run automatically to install dependencies in each of the individual packages.

### Adding/updating dependencies

Rather than using `npm install` in individual packages, use [`lerna add`](https://github.com/lerna/lerna/tree/master/commands/add#readme) from the root. Examples:

```sh
# To add `glob` to definitions-parser:
lerna add glob packages/definitions-parser

# To add testdouble as a devDependency to publisher:
lerna add --dev testdouble packages/publisher

# To add typescript to all packages:
lerna add typescript
```

The exception to this rule is devDependencies that are shared between all packages: those can added to the root package.json with `npm` directly.

### Testing

All packages use [jest](https://github.com/facebook/jest), with a single configuration set up to be run from the monorepo root. `npm test` is an alias for `jest`, so you can run tests with any of [jest’s CLI options](https://jestjs.io/docs/en/cli). For example, to run tests for a single package:

```sh
npm test -- packages/utils
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

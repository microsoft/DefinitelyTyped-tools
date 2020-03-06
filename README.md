# DefinitelyTyped/tools

_✨ Under construction ✨_

A monorepo for formerly disparate DefinitelyTyped-related tools:

- [header-parser](packages/header-parser): [microsoft/definitelytyped-header-parser](https://github.com/microsoft/definitelytyped-header-parser)
- [definitions-parser](packages/definitions-parser): the part of [microsoft/types-publisher](https://github.com/microsoft/types-publisher) that reads DefinitelyTyped repository data
- [publisher](packages/publisher): the rest of [microsoft/types-publisher](https://github.com/microsoft/types-publisher)
- [utils](packages/utils): shared utilities, mostly extracted from [microsoft/types-publisher](https://github.com/microsoft/types-publisher)

## Local development

This is a monorepo managed with [lerna](https://github.com/lerna/lerna). After cloning, run `npm install`. `lerna bootstrap` will be run automatically to install dependencies in each of the individual packages.

### Testing

All packages use [jest](https://github.com/facebook/jest), with a single configuration set up to be run from the monorepo root. `npm test` is an alias for `jest`, so you can run tests with any of [jest’s CLI options](https://jestjs.io/docs/en/cli). For example, to run tests for a single package:

```sh
npm test -- packages/utils
```

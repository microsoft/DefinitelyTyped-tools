# publish-registry

[![Publish registry](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/publish-registry.yml/badge.svg)](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/publish-registry.yml)

Publish the [`types-registry`](https://www.npmjs.com/package/types-registry) package to npm (a list of all @types packages in the DT repo.

## Use

```sh
yarn workspace @definitelytyped/publisher parse
node packages/publish-registry/
```

1. [Parse declarations](../publisher/README.md#parse-the-definitions).
2. Run this package's script.

### Options

<dl><dt>

`--dry`

</dt><dd>

Don't actually publish the package, just show what would be done.

</dd></dl>

### Environment variables

<dl><dt>

[`NPM_TOKEN`](https://docs.npmjs.com/about-access-tokens)

</dt><dd>

Not required for a dry run.
Only used to actually publish the package.

</dd></dl>

## Logs

GitHub Actions runs this package's script weekly.
You can [examine the logs](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/publish-registry.yml).

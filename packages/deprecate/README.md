# deprecate

[![Mark removed types as deprecated](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/deprecate.yml/badge.svg)](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/deprecate.yml)

Loop over npm @types packages and mark as deprecated any that no longer exist in the DT repo.

## Use

```sh
yarn workspace @definitelytyped/publisher parse
node packages/deprecate/
```

1. [Parse declarations](../publisher/README.md#parse-the-definitions).
2. Run this package's script.

### Options

<dl><dt>

`--dry-run`

</dt><dd>

Don't actually mark anything as deprecated, just show what would be done.

</dd></dl>

### Environment variables

<dl><dt>

`GITHUB_TOKEN`

</dt><dd>

Required.
Used to talk to [GitHub's GraphQL API](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#authenticating-with-graphql), to find the commit/PR that removed the types.
That data is public and a GitHub Actions [automatic token](https://docs.github.com/en/actions/security-guides/automatic-token-authentication) is sufficient.

</dd><dt>

[`NPM_TOKEN`](https://docs.npmjs.com/about-access-tokens)

</dt><dd>

Not required for a dry run.
Only used to actually mark @types packages as deprecated.

</dd></dl>

## Logs

GitHub Actions runs this package's script weekly.
You can [examine the logs](https://github.com/microsoft/DefinitelyTyped-tools/actions/workflows/deprecate.yml).

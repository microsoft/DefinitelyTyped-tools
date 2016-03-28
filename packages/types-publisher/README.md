## Commandline arguments

### `--skipPublish`

Passing `--skipPublish` causes the `npm publish` step to be skipped.
Version numbers in `version.json` are subsequently not changed.

This is useful for debugging purposes.

### `--forceUpdate`

Passing `--forceUpdate` causes all version checks to be treated as "needs update".
Additionally, version numbers are incremented by 2 instead of by 1 (to handle
the error situations where a package was updated, but versions.json was unchanged).

You can combine `--skipPublish` and `--forceUpdate` to generate a complete set of packages
  on disk for testing purposes.

## settings.json

This file contains settings used by the publisher.

The following properties are supported:

### scopeName

Required. Example value: `types`

This changes the scope name packages are published under.
Do not prefix this value with `@`.

### outputPath

Required. Example value: `./output`

This is the path where packages are written to before publishing.

### definitelyTypedPath

Required. Example value: `../DefinitelyTyped`

This is the path to the DefinitelyTyped (or other similarly-structured) repo.

### prereleaseTag

Optional. Example value `alpha`

If present, packages are published with an e.g. `-alpha` prerelease tag as part of the version.

### tag

Optional. Example value `latest`

If present, packages are published with the provided version tag.


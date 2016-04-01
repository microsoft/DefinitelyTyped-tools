## Workflow

There are four steps in the typings publish process

### Parse

The *parse* step parses each folder in the source repo.
This generates a `types-data.json` file.

### Search

The *search* step generates search metadata from the `types-data.json` file.

### Generate

The *generate* step generates NPM packages on disk.
This step increments version numbers in `versions.json` if the content in the originating folder has changed.

### Publish

The *publish* step publishes all generated packages to NPM.

## Commandline arguments

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


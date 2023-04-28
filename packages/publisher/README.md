
[![Build Status](https://travis-ci.org/microsoft/types-publisher.svg?branch=master)](https://travis-ci.org/microsoft/types-publisher)

# About

This is the source code for the types-publisher service, which publishes the contents of [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) to npm.

# Disclaimer

If there's functionality from the project you'd like to use, please file an issue detailing that. The script isn't intended for public consumption (i.e. we will break the API whenever convenient for us).

# Filing issues

If you've noticed a problem with the way a package is published, file an issue here.
If you don't like the contents of a given definition, file an issue (or pull request) on [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) instead.

# Manually running

Normally, types-publisher is run on a loop every 2,000 seconds (33 minutes), but to test it out you can do it yourself.
You will need to see the [Environment variables](#environment-variables) section first.

```
cat settings.json
```
Make sure your settings are correct.

```
npm run build
npm run full
```

*or*
```
npm run build
npm run clean
npm run parse
npm run calculate-versions
npm run generate
npm run publish-packages
```

and optionally (in production, these run once a week):

```
npm run publish-registry
npm run validate
```

You can run tests with

```
npm run test
```

# Overview

To update the types packages, the following steps must be performed:

	* Parse the definitions
	* Calculate versions
	* Generate packages on disk
	* Publish packages on disk

Importantly, each of these steps is *idempotent*.
Running the entire sequence twice should not have any different results unless one of the inputs has changed.

# Parse the definitions

First, obtain a local copy of the DefinitelyTyped repo. For running
locally, the script assumes that it is at `../DefinitelyTyped` and
checks to make sure that it has no outstanding changes. It does *not*
check that it has master checked out. For running in the cloud, the script
downloads a gzipped copy and unzips it into memory. This saves a lot
of time if the filesystem is very slow.

You can manually run this step locally with `npm run get-definitely-typed`.
Pass `--dry` to download the DefinitelyTyped copy and unzip it into memory.

> `npm run parse`

This generates the data file `data/definitions.json`.
All future steps depend on this file.
One can also pass `--single=package_name` to test this on a single package.

## Contents of `data/definitions.json`

This file is a key/value mapping used by other steps in the process.

### Example entry
```json
{
    "jquery": {
        "3.3": {
            "libraryName": "jquery",
            "typingsPackageName": "jquery",
            "projectName": "https://jquery.com",
            "contributors": [
                {
                    "name": "Boris Yankov",
                    "url": "https://github.com/borisyankov",
                    "githubUsername": "borisyankov"
                }
            ],
            "libraryMajorVersion": 3,
            "libraryMinorVersion": 3,
            "minTsVersion": "2.3",
            "typesVersions": [],
            "files": [
                "JQuery.d.ts",
                "JQueryStatic.d.ts",
                "dist/jquery.slim.d.ts",
                "index.d.ts",
                "legacy.d.ts",
                "misc.d.ts"
            ],
            "license": "MIT",
            "dependencies": {
                "sizzle": "*"
            },
            "testDependencies": [],
            "pathMappings": [],
            "packageJsonDependencies": [],
            "contentHash": "6f3ac74aa9f284b3450b4dcbcabc842bfc2a70fa2d92e745851044d2bb78e94b",
            "globals": [
                "$",
                "Symbol",
                "jQuery"
            ],
            "declaredModules": [
                "jquery",
                "jquery/dist/jquery.slim"
            ]
		}
	}
}
```

### Fields in `data/definitions.json`

A key of the root object represents the name of the *folder* of a definition package, as it exists in the source repo. Its corresponding value holds a
an object that represents the versions of the package for which definitions are provided in parallel. Each version entry holds data about the package;
refer to [the `TypingsDataRaw` interface declaration](./src/lib/packages.ts) for details on this data.

## Contents of `logs/parser-log-summary.md`

This log file contains a summary of the outcome of each declaration, as well as a set of warnings.

### Failure States

Currently, the only error condition is if there are multiple .d.ts files in the declaration folder and none of them are the obvious entry point.
These will be listed in the *warnings* section of `parser-log-summary.md`; search for "Found either zero or more" in this file.

### Warnings

The following warnings may be present.
Some warnings block package creation and should be addressed sooner.

#### Too Many Files

> Found either zero or more than one .d.ts file and none of google-apps-script.d.ts or index.d.ts

This warning means the script could not determine what the entry point .d.ts file was.
Fix this by renaming some .d.ts file to the containing folder name, or index.d.ts.
This warning blocks package creation.

#### Incorrect Declared Module

> Declared module `howler` is in folder with incorrect name `howlerjs`

This warning means that a module declaration's name does not match the containing folder's name.
Determine which is correct and rename the folder or the module declaration appropriately.

#### Casing

> Package name joData should be strictly lowercase

Nearly all package names should be lowercased to conform with NPM naming standards.
This warning might not be appropriate; consider logging an issue.

# Calculate versions

This generates `versions.json` based on the last uploaded `versions.json` and by the content hashes computed during parsing.

## Arguments to `calculate-versions`

The `--forceUpdate` argument will cause a build version bump even if the `contentHash` of the originating types folder has not changed.
This argument may be needed during development, but should not be used during routine usage.

# Generate packages on disk

> `npm run generate`

This step writes all type packages to disk.
The output folder is specified in `settings.json` (see section "Settings").

## Arguments to `generate`

Use the `--tgz` option to create `.tgz` archives as well. These should represent what is actually uploaded to NPM.

## Outputs of `generate`

### Package Folders

The package generation step creates a folder for each package under the output folder.

The following files are produced automatically:
 * `package.json`
 * `README.md`
 * `metadata.json`: This is the entry from `definitions.json`, excluding the `root` property
 * All declaration files are transformed and copied over

### Definition File Transforms

The following changes occur when a file is transformed:
* `/// <reference path=` directives are changed to corresponding `/// <reference types=` directives
* The file is saved in UTF-8 format

### `logs/package-generator.md`

This file is currently uninteresting.

# Publish packages on disk

> `npm run publish`

This step publishes the files to the NPM registry.

Several keys in `settings.json` affect this step; be sure to read this section.

Before publishing, the script checks the NPM registry to see if a package with the same version number has already been published.
If so, the publishing is skipped.

## Outputs of `publish`

### `logs/publishing.md`

This log file indicates which packages were published and which were skipped.
It also indicates any errors that may have occurred during publishing.

Note that unlike other steps, this log file output is *not* idempotent.
Scripts should save this log under a unique filename so any errors may be reviewed.

# Publish registry

> `npm run publish -- [--dry]`

This step publishes the `types-registry` package on NPM, which keeps a list of all `@types` packages.
This step only happens if there are some new packages to register.

# Settings

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

### sourceRepository

This is the URL of the DefinitelyTyped repo.

### tag

Optional. Example value `latest`

If present, packages are published with the provided version tag.

## Environment variables

#### `TYPES_PUBLISHER_CLIENT_ID` and `TYPES_PUBLISHER_CLIENT_SECRET`

These are needed to access all other secrets. See `src/lib/secrets.ts`.

### `LONGJOHN`

Setting this variable turns on [longjohn](https://github.com/mattinsler/longjohn) stacktraces.

### `NPM_TOKEN` and `GH_API_TOKEN`

These are needed for running repair scripts, which should be rare.
You could also use them for emergency local runs of the publisher, but I have never needed to do this.
You can find these values in the secret store.

### Set environment variables in Azure

* Go to https://ms.portal.azure.com
* Go to `types-publisher` (*not* the `typespublisher` storage account)
* Go to Settings -> General -> Application settings -> App Settings


# Validating published packages

To validate published packages run:

```sh
npm run build
npm run validate [<package>]
```

for instance:

```sh
npm run validate node express jquery
```

will try to install the three packages, and run the tsc compiler on them.

Specifing no options to the command will validate **all** known packages.

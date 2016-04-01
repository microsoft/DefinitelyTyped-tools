# Overview

To update the types packages, the following steps must be performed:

 * Update the local DefinitelyTyped repo
 * Parse the definitions
 * Check for conflicts
 * Create a search index
 * Generate packages on disk
 * Publish packages on disk

Importantly, each of these steps is *idempotent*.
Running the entire sequence twice should not have any different results
  unless one of the inputs has changed.
 
# Update the local DefinitelyTyped repo

This is not handled automatically.
This step needs to be handled as part of any automatic update script.

# Parse the definitions

> `node bin/parse-definitions.js`

This generates the data file `data/definitions.json`.
All future steps depend on this file.

## Contents of `data/definitions.json`

This file is a key/value mapping used by other steps in the process.

### Example entry
```js
"jquery": {
    "authors": "Boris Yankov <https://github.com/borisyankov/>",
    "definitionFilename": "jquery.d.ts",
    "libraryDependencies": [],
    "moduleDependencies": [],
    "libraryMajorVersion": "1",
    "libraryMinorVersion": "10",
    "libraryName": "jQuery 1.10.x / 2.0.x",
    "typingsPackageName": "jquery",
    "projectName": "http://jquery.com/",
    "sourceRepoURL": "https://www.github.com/DefinitelyTyped/DefinitelyTyped",
    "kind": "Mixed",
    "globals": [
        "jQuery",
        "$"
    ],
    "declaredModules": [
        "jquery"
    ],
    "root": "C:\\github\\DefinitelyTyped\\jquery",
    "files": [
        "jquery.d.ts"
    ],
    "contentHash": "5cfce9ba1a777bf2eecb20d0830f4f4bcd5eee2e1fd9936ca6c2f2201a44b618"
}
```

### Fields in `data/definitions.json`

 * `"jquery"` (i.e. the property name): The name of the *folder* from the source repo
 * `authors`: Author data parsed from a header comment in the entry point .d.ts file
 * `definitionFilename`: The filename of the entry point .d.ts file. This file must be either `index.d.ts`, `folderName.d.ts` (where `folderName` is the folder name), or the only .d.ts file in the folder
 * `libraryDependencies`: Which other definitions this file depends on. These will refer to *package names*, not *folder names*
 * `libraryMajorVersion` / `libraryMinorVersion`: Version data parsed from a header comment in the entry point .d.ts. These values will be `0` if the entry point .d.ts file did not specify a version
 * `libraryName`: Library name parsed from a header comment in the entry point .d.ts file
 * `typingsPackageName`: The name on NPM that the type package will be published under
 * `projectName`: Project name or URL information parsed from a header comment in the entry point .d.ts file
 * `sourceRepoURL`: The URL to the originating type definition repo. Currently hardcoded to DefinitelyType's URL
 * `kind`: One of the following strings based on the declarations in the folder:
   * `Unknown`: The type of declaration could not be detected
   * `MultipleModules`: Multiple ambient module declarations (`declare module "modName" {`) were found
   * `Mixed`: At least one global declaration and exactly one ambient module declaration
   * `DeclareModule`: Exactly one ambient module declaration and zero global declarations
   * `Global`: Only global declarations. **Preferred**
   * `ProperModule`: Only top-level `import` and `export` declarations. **Preferred**
   * `ModuleAugmentation`: An ambient module declaration and at top-level `import` or `export` declaration. **Preferred**
   * `UMD`: Only top-level `import` and `export` declarations, as well as a UMD declaration. **Preferred**
   * `OldUMD`: Exactly one namespace declaration and exactly one ambient module declaration
 * `globals`: A list of *values* declared in the global namespace. Note that this does not include types declared in the global namespace
 * `declaredModules`: A list of modules declared. If `kind` is `ProperModule`, this list will explicitly list the containing folder name
 * `root`: A full path to the declaration folder
 * `files`: A list of the .d.ts files in the declaration folder
 * `contentHash`: A hash of the names and contents of the `files` list, used for versioning

## Contents of `logs/parser-log-summary.md`

This log file contains a summary of the outcome of each declaration,
  as well as a set of warnings.

### Failure States

Currently, the only error condition is if there are multiple .d.ts files in the declaration folder
  and none of them are the obvious entry point.
These will be listed in the *warnings* section of `parser-log-summary.md`;
  search for "Found either zero or more" in this file.

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

# Check for conflicts

> `node bin/check-parse-results.js`

This is an optional script that checks for multiple declaration packages
  with the same library name or same project name.

### Contents of `logs/conflicts.md`

> * Duplicate Library Name descriptions "Marked"
>   * marked
>   * ngwysiwyg

Examine these declarations and change them to have distinct library names, if possible.

> * Duplicate Project Name descriptions "https://github.com/jaredhanson/passport-facebook"
>   * passport-facebook
>   * passport-google-oauth
>   * passport-twitter

Examine these declarations and change them to have distinct package names, if possible.

# Create a search index

> `node bin/create-search-index.js`

This script creates several data files useful for offering fast search of types data.
This step is not necessary for other steps in the process.

### Arguments to `create-search-index`

By default, this script fetches download counts from NPM for use in search result ranking.
The argument `--skipDownloads` disables this behavior.

### Outputs of `create-search-index`

This script generates the following files
 * `data/search-index-full.json`: An unminified index useful for searching
 * `data/search-index-min.json`: A minified index useful for searching
 * `data/search-index-head.json`: A minified index of the top 100 most-downloaded packages

### Minified and Unminified Search Entries

Each `search-*.json` file consists of an array.
An example unminified entry is:
```js
    {
        "projectName": "http://backgridjs.com/",
        "libraryName": "Backgrid",
        "globals": [
            "Backgrid"
        ],
        "typePackageName": "backgrid",
        "declaredExternalModules": [
            "backgrid"
        ],
        "downloads": 532234
    },
```
These fields should hopefully be self-explanatory.
`downloads` refers to the number in the past month.
If `--skipDownloads` was specified, `downloads` will be -1.
In the case where the type package name is different from the NPM package name,
  or no NPM package name exists, `downloads` will be 0.

In the minified files, the properties are simply renamed:
 * `typePackageName` is `t`
 * `globals` is `g`
 * `declaredExternalModules` is `m`
 * `projectName` is `p`
 * `libraryName` is `l`
 * `downlaods` is `d`

Empty arrays may be elided in future versions of the minified files.

# Generate packages on disk

> `node bin/generate-packages.js`

This step writes all type packages to disk.
The output folder is specified in `settings.json` (see section "Settings").

## Arguments to `generate-packages`

The `--forceUpdate` argument will cause a build version bump even if
  the `contentHash` of the originating types folder has not changed.
This argument may be needed during development,
  but should not be used during routine usage.

## Outputs of `generate-packages`

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

> `node bin/publish-packages.js`

This step runs `npm publish` to publish the files to the NPM registry.

Several keys in `settings.json` affect this step; be sure to read this section.

As a prerequisite,
  the appropriate `npm login` command must be manually executed
  to ensure the same user as the `scopeName` setting is logged in.

Before publishing, the script checks the NPM registry to see if a package
  with the same version number has already been published.
If so, the publishing is skipped.

## Outputs of `publish-packages.js`

### `logs/publishing.md`

This log file indicates which packages were published and which were skipped.
It also indicates any errors that may have occurred during publishing.

Note that unlike other steps, this log file output is *not* idempotent.
Scripts should save this log under a unique filename so any errors may be reviewed.

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

### prereleaseTag

Optional. Example value `alpha`

If present, packages are published with an e.g. `-alpha` prerelease tag as part of the version.

### tag

Optional. Example value `latest`

If present, packages are published with the provided version tag.


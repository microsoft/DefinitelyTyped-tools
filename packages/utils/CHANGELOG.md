# @definitelytyped/utils

## 0.1.5

### Patch Changes

- b287cf9: Move TypeScript installer code to dtslint

## 0.1.4

### Patch Changes

- 5e7da60: Fix compatibility with Windows

## 0.1.3

### Patch Changes

- e2aef2f: Pull expectedNpmVersionFailures from GitHub, like allowedPackageJsonDependencies

## 0.1.2

### Patch Changes

- 31de5d3: Run arethetypeswrong from in-memory tarball data
- 9da3fc7: Detect package names added/removed from attw.json as changed

## 0.1.1

### Patch Changes

- aa08460: Change suggestionsDir to use the user’s cache dir instead of .dts the user’s home dir
- aa08460: Expose suggestionsDir

## 0.1.0

### Minor Changes

- 2d7a5d3: Require Node 18+

### Patch Changes

- Updated dependencies [2d7a5d3]
  - @definitelytyped/typescript-packages@0.1.0
  - @definitelytyped/typescript-versions@0.1.0

## 0.0.192

### Patch Changes

- 2c3e5de: Update dependencies

## 0.0.191

### Patch Changes

- Updated dependencies [4522dfba]
  - @definitelytyped/typescript-versions@0.0.184
  - @definitelytyped/typescript-packages@0.0.4

## 0.0.190

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/typescript-packages@0.0.3
  - @definitelytyped/typescript-versions@0.0.183

## 0.0.189

### Patch Changes

- f53f17f6: Use package dependencies to manage TypeScript, instead of `$HOME/.dts`
- Updated dependencies [f53f17f6]
- Updated dependencies [f53f17f6]
  - @definitelytyped/typescript-packages@0.0.2

## 0.0.188

### Patch Changes

- Updated dependencies [8288affb]
  - @definitelytyped/typescript-versions@0.0.182

## 0.0.187

### Patch Changes

- 85379bf8: Fix writeJson helper, path and contents swapped

## 0.0.186

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/typescript-versions@0.0.181

## 0.0.185

### Patch Changes

- 5d83a8ed: Fix loading on Windows
- 5d83a8ed: Fix command execution, paths on Windows

## 0.0.184

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

## 0.0.183

### Patch Changes

- Updated dependencies [90e1d0ae]
  - @definitelytyped/typescript-versions@0.0.180

## 0.0.182

### Patch Changes

- 2b3138a0: Throw parse errors early now that more stuff is lazy

## 0.0.181

### Patch Changes

- 97f68d6e: Fix one more missing corepack issue, env in exec util

## 0.0.180

### Patch Changes

- d01cacd5: Make AllPackages lazy and asynchronous

## 0.0.179

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- 9fffa8ff: Add `compact` collection utility
- Updated dependencies [024c3e73]
  - @definitelytyped/typescript-versions@0.0.179

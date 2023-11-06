# @definitelytyped/utils

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

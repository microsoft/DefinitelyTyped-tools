# @definitelytyped/definitions-parser

## 0.1.12

### Patch Changes

- Updated dependencies [f014cc6]
  - @definitelytyped/utils@0.1.6
  - @definitelytyped/header-parser@0.2.9

## 0.1.11

### Patch Changes

- adfd769: Allow packages to test multiple tsconfigs by specifying list of tsconfigs in package.json
- Updated dependencies [adfd769]
  - @definitelytyped/header-parser@0.2.8

## 0.1.10

### Patch Changes

- 946d3d4: Update for TS 5.4
- Updated dependencies [946d3d4]
  - @definitelytyped/typescript-versions@0.1.1
  - @definitelytyped/header-parser@0.2.7

## 0.1.9

### Patch Changes

- Updated dependencies [b287cf9]
  - @definitelytyped/utils@0.1.5
  - @definitelytyped/header-parser@0.2.6

## 0.1.8

### Patch Changes

- 5e7da60: Fix compatibility with Windows
- Updated dependencies [5e7da60]
  - @definitelytyped/utils@0.1.4
  - @definitelytyped/header-parser@0.2.5

## 0.1.7

### Patch Changes

- e2aef2f: Pull expectedNpmVersionFailures from GitHub, like allowedPackageJsonDependencies
- Updated dependencies [e2aef2f]
  - @definitelytyped/utils@0.1.3
  - @definitelytyped/header-parser@0.2.4

## 0.1.6

### Patch Changes

- 9da3fc7: Detect package names added/removed from attw.json as changed
- Updated dependencies [31de5d3]
- Updated dependencies [9da3fc7]
  - @definitelytyped/utils@0.1.2
  - @definitelytyped/header-parser@0.2.3

## 0.1.5

### Patch Changes

- c4d8b9c: Prevent crash on an empty commit
- 3e799c3: Add --diffBase to configure diffing
- 3e799c3: Do not fetch automatically fetch master on run

## 0.1.4

### Patch Changes

- b419d1c: Don't look for dependents of packages with deleted files if those packages were not fully deleted

## 0.1.3

### Patch Changes

- e6880b0: Don't error when scripts are modified

## 0.1.2

### Patch Changes

- Updated dependencies [4216821]
  - @definitelytyped/header-parser@0.2.2

## 0.1.1

### Patch Changes

- Updated dependencies [aa08460]
- Updated dependencies [aa08460]
  - @definitelytyped/utils@0.1.1
  - @definitelytyped/header-parser@0.2.1

## 0.1.0

### Minor Changes

- 2d7a5d3: Require Node 18+

### Patch Changes

- Updated dependencies [2d7a5d3]
  - @definitelytyped/typescript-versions@0.1.0
  - @definitelytyped/header-parser@0.2.0
  - @definitelytyped/utils@0.1.0

## 0.0.202

### Patch Changes

- 2c3e5de: Update dependencies
- 795e0e3: Handle git moves in gitChanges
- Updated dependencies [2c3e5de]
  - @definitelytyped/header-parser@0.1.2
  - @definitelytyped/utils@0.0.192

## 0.0.201

### Patch Changes

- 50cc5dce: loosen checkParseResults

## 0.0.200

### Patch Changes

- Updated dependencies [987c9d5d]
  - @definitelytyped/header-parser@0.1.1

## 0.0.199

### Patch Changes

- Updated dependencies [02c11c32]
  - @definitelytyped/header-parser@0.1.0

## 0.0.198

### Patch Changes

- Updated dependencies [4522dfba]
  - @definitelytyped/typescript-versions@0.0.184
  - @definitelytyped/header-parser@0.0.193
  - @definitelytyped/utils@0.0.191

## 0.0.197

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/typescript-versions@0.0.183
  - @definitelytyped/header-parser@0.0.192
  - @definitelytyped/utils@0.0.190

## 0.0.196

### Patch Changes

- Updated dependencies [f53f17f6]
  - @definitelytyped/utils@0.0.189
  - @definitelytyped/header-parser@0.0.191

## 0.0.195

### Patch Changes

- Updated dependencies [8288affb]
  - @definitelytyped/typescript-versions@0.0.182
  - @definitelytyped/header-parser@0.0.190
  - @definitelytyped/utils@0.0.188

## 0.0.194

### Patch Changes

- 926d5ab0: Fix getAffectedPackages for PRs which modify only versioned dirs

## 0.0.193

### Patch Changes

- Updated dependencies [85379bf8]
  - @definitelytyped/utils@0.0.187
  - @definitelytyped/header-parser@0.0.189

## 0.0.192

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/typescript-versions@0.0.181
  - @definitelytyped/header-parser@0.0.188
  - @definitelytyped/utils@0.0.186

## 0.0.191

### Patch Changes

- 5d83a8ed: Fix command execution, paths on Windows
- Updated dependencies [5d83a8ed]
- Updated dependencies [5d83a8ed]
  - @definitelytyped/utils@0.0.185
  - @definitelytyped/header-parser@0.0.187

## 0.0.190

### Patch Changes

- 8272a9d2: Don't treat script dirs as types packages

## 0.0.189

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

- Updated dependencies [a18ce6b1]
  - @definitelytyped/header-parser@0.0.186
  - @definitelytyped/utils@0.0.184

## 0.0.188

### Patch Changes

- Updated dependencies [90e1d0ae]
  - @definitelytyped/typescript-versions@0.0.180
  - @definitelytyped/header-parser@0.0.185
  - @definitelytyped/utils@0.0.183

## 0.0.187

### Patch Changes

- 046ac38e: Ignore non-types packages returned by pnpm

## 0.0.186

### Patch Changes

- Updated dependencies [f9e73605]
  - @definitelytyped/header-parser@0.0.184

## 0.0.185

### Patch Changes

- c0b13e4b: Allow PRs to delete files
- Updated dependencies [2b3138a0]
  - @definitelytyped/utils@0.0.182
  - @definitelytyped/header-parser@0.0.183

## 0.0.184

### Patch Changes

- c8d8b1f8: Fix dependent packages showing up as changed in getAffectedPackages
- Updated dependencies [97f68d6e]
  - @definitelytyped/utils@0.0.181
  - @definitelytyped/header-parser@0.0.182

## 0.0.183

### Patch Changes

- d01cacd5: Make AllPackages lazy and asynchronous
- Updated dependencies [d01cacd5]
  - @definitelytyped/utils@0.0.180
  - @definitelytyped/header-parser@0.0.181

## 0.0.182

### Patch Changes

- 13922c30: Ignore non-types packages when checking for changed packages

## 0.0.181

### Patch Changes

- 8cae0671: Add semver types to dependencies in definitions-parser
- 22ffaadf: Always convert contributor githubUsername to url (missing changeset)
- Updated dependencies [22ffaadf]
  - @definitelytyped/header-parser@0.0.180

## 0.0.180

### Patch Changes

- 3c8512ad: dtslint-runner checks new packages, even malformed ones.

## 0.0.179

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- 9fffa8ff: Fix entrypoint scripts to ensure they don’t run when being imported by an ES module
- Updated dependencies [024c3e73]
- Updated dependencies [9fffa8ff]
  - @definitelytyped/typescript-versions@0.0.179
  - @definitelytyped/header-parser@0.0.179
  - @definitelytyped/utils@0.0.179

# @definitelytyped/header-parser

## 0.2.8

### Patch Changes

- adfd769: Allow packages to test multiple tsconfigs by specifying list of tsconfigs in package.json

## 0.2.7

### Patch Changes

- Updated dependencies [946d3d4]
  - @definitelytyped/typescript-versions@0.1.1

## 0.2.6

### Patch Changes

- Updated dependencies [b287cf9]
  - @definitelytyped/utils@0.1.5

## 0.2.5

### Patch Changes

- Updated dependencies [5e7da60]
  - @definitelytyped/utils@0.1.4

## 0.2.4

### Patch Changes

- Updated dependencies [e2aef2f]
  - @definitelytyped/utils@0.1.3

## 0.2.3

### Patch Changes

- Updated dependencies [31de5d3]
- Updated dependencies [9da3fc7]
  - @definitelytyped/utils@0.1.2

## 0.2.2

### Patch Changes

- 4216821: Add @arethetypeswrong/cli run

## 0.2.1

### Patch Changes

- Updated dependencies [aa08460]
- Updated dependencies [aa08460]
  - @definitelytyped/utils@0.1.1

## 0.2.0

### Minor Changes

- 2d7a5d3: Require Node 18+

### Patch Changes

- Updated dependencies [2d7a5d3]
  - @definitelytyped/typescript-versions@0.1.0
  - @definitelytyped/utils@0.1.0

## 0.1.2

### Patch Changes

- 2c3e5de: Update dependencies
- Updated dependencies [2c3e5de]
  - @definitelytyped/utils@0.0.192

## 0.1.1

### Patch Changes

- 987c9d5d: Remove tsutils exemption from header-parser

## 0.1.0

### Minor Changes

- 02c11c32: Remove TSLint remnants

## 0.0.193

### Patch Changes

- Updated dependencies [4522dfba]
  - @definitelytyped/typescript-versions@0.0.184
  - @definitelytyped/utils@0.0.191

## 0.0.192

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/typescript-versions@0.0.183
  - @definitelytyped/utils@0.0.190

## 0.0.191

### Patch Changes

- Updated dependencies [f53f17f6]
  - @definitelytyped/utils@0.0.189

## 0.0.190

### Patch Changes

- Updated dependencies [8288affb]
  - @definitelytyped/typescript-versions@0.0.182
  - @definitelytyped/utils@0.0.188

## 0.0.189

### Patch Changes

- Updated dependencies [85379bf8]
  - @definitelytyped/utils@0.0.187

## 0.0.188

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/typescript-versions@0.0.181
  - @definitelytyped/utils@0.0.186

## 0.0.187

### Patch Changes

- Updated dependencies [5d83a8ed]
- Updated dependencies [5d83a8ed]
  - @definitelytyped/utils@0.0.185

## 0.0.186

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

- Updated dependencies [a18ce6b1]
  - @definitelytyped/utils@0.0.184

## 0.0.185

### Patch Changes

- Updated dependencies [90e1d0ae]
  - @definitelytyped/typescript-versions@0.0.180
  - @definitelytyped/utils@0.0.183

## 0.0.184

### Patch Changes

- f9e73605: Remove validation of `"pnpm"` field

## 0.0.183

### Patch Changes

- Updated dependencies [2b3138a0]
  - @definitelytyped/utils@0.0.182

## 0.0.182

### Patch Changes

- Updated dependencies [97f68d6e]
  - @definitelytyped/utils@0.0.181

## 0.0.181

### Patch Changes

- Updated dependencies [d01cacd5]
  - @definitelytyped/utils@0.0.180

## 0.0.180

### Patch Changes

- 22ffaadf: Always convert contributor githubUsername to url (missing changeset)

## 0.0.179

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- Updated dependencies [024c3e73]
- Updated dependencies [9fffa8ff]
  - @definitelytyped/typescript-versions@0.0.179
  - @definitelytyped/utils@0.0.179

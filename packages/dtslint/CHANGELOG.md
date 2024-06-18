# @definitelytyped/dtslint

## 0.2.21

### Patch Changes

- Updated dependencies [b2c15e6]
  - @definitelytyped/typescript-packages@0.1.2
  - @definitelytyped/typescript-versions@0.1.2
  - @definitelytyped/header-parser@0.2.10

## 0.2.20

### Patch Changes

- Updated dependencies [f014cc6]
  - @definitelytyped/utils@0.1.6
  - @definitelytyped/header-parser@0.2.9

## 0.2.19

### Patch Changes

- 98f77bf: Allow the `jsxImportSource` compiler option.

## 0.2.18

### Patch Changes

- e32483b: Retry and ignore npm errors

## 0.2.17

### Patch Changes

- adfd769: Allow packages to test multiple tsconfigs by specifying list of tsconfigs in package.json
- Updated dependencies [adfd769]
  - @definitelytyped/header-parser@0.2.8

## 0.2.16

### Patch Changes

- 946d3d4: Update for TS 5.4
- Updated dependencies [946d3d4]
  - @definitelytyped/typescript-packages@0.1.1
  - @definitelytyped/typescript-versions@0.1.1
  - @definitelytyped/header-parser@0.2.7

## 0.2.15

### Patch Changes

- 465dbce: Error on versioned directories when parent npmignores are missing subdir
- 5dae397: Switch expect to using settings for versionsToTest

## 0.2.14

### Patch Changes

- b287cf9: Move TypeScript installer code to dtslint
- Updated dependencies [b287cf9]
  - @definitelytyped/utils@0.1.5
  - @definitelytyped/header-parser@0.2.6

## 0.2.13

### Patch Changes

- Updated dependencies [5e7da60]
  - @definitelytyped/utils@0.1.4
  - @definitelytyped/header-parser@0.2.5

## 0.2.12

### Patch Changes

- e2aef2f: Pull expectedNpmVersionFailures from GitHub, like allowedPackageJsonDependencies
- Updated dependencies [e2aef2f]
  - @definitelytyped/utils@0.1.3
  - @definitelytyped/header-parser@0.2.4

## 0.2.11

### Patch Changes

- b9ca741: remove `aws-lambda` from expected npm version failures
- b2f229a: Update arethetypeswrong

## 0.2.10

### Patch Changes

- 7668808: Update @arethetypeswrong/cli

## 0.2.9

### Patch Changes

- 57bb3ea: Rework error collection
- 57bb3ea: Error if tslint.json is present
- a79806d: Update arethetypeswrong version

## 0.2.8

### Patch Changes

- aa26880: Don’t crash when implementation package fails to extract

## 0.2.7

### Patch Changes

- 31de5d3: Run arethetypeswrong from in-memory tarball data
- 9da3fc7: Detect package names added/removed from attw.json as changed
- Updated dependencies [31de5d3]
- Updated dependencies [9da3fc7]
  - @definitelytyped/utils@0.1.2
  - @definitelytyped/header-parser@0.2.3

## 0.2.6

### Patch Changes

- 2f106cb: Add missing warning logging

## 0.2.5

### Patch Changes

- 4216821: Add @arethetypeswrong/cli run
- Updated dependencies [4216821]
  - @definitelytyped/header-parser@0.2.2

## 0.2.4

### Patch Changes

- d7c81c7: Re-allow packages without tests
- d7c81c7: Allow ./index.d.ts (with ./ prefix)

## 0.2.3

### Patch Changes

- 811aa2f: Allow .tsx tests in tsconfig

## 0.2.2

### Patch Changes

- fc26705: Require 1 .d.ts, 1 .ts in tsconfigs

## 0.2.1

### Patch Changes

- Updated dependencies [aa08460]
- Updated dependencies [aa08460]
  - @definitelytyped/utils@0.1.1
  - @definitelytyped/header-parser@0.2.1

## 0.2.0

### Minor Changes

- 2d7a5d3: Require Node 18+

### Patch Changes

- Updated dependencies [2d7a5d3]
  - @definitelytyped/typescript-versions@0.1.0
  - @definitelytyped/header-parser@0.2.0
  - @definitelytyped/utils@0.1.0

## 0.1.5

### Patch Changes

- 2c3e5de: Update dependencies
- Updated dependencies [2c3e5de]
  - @definitelytyped/header-parser@0.1.2
  - @definitelytyped/utils@0.0.192

## 0.1.4

### Patch Changes

- 0a7fc7aa: Fix OOM when developing locally

## 0.1.3

### Patch Changes

- bbc3c792: Skip only npm-naming in dependents

## 0.1.2

### Patch Changes

- 1a5fdc83: Remove test files from packages
- 6ff1c7bf: Require index.d.ts

## 0.1.1

### Patch Changes

- 10ad5d01: Clean up eslint options contruction
- Updated dependencies [987c9d5d]
  - @definitelytyped/header-parser@0.1.1

## 0.1.0

### Minor Changes

- 02c11c32: Remove TSLint remnants

### Patch Changes

- Updated dependencies [02c11c32]
  - @definitelytyped/header-parser@0.1.0

## 0.0.204

### Patch Changes

- efd262c9: Prevent npm-naming from being enabled in expectOnly
- Updated dependencies [4522dfba]
  - @definitelytyped/typescript-versions@0.0.184
  - @definitelytyped/header-parser@0.0.193
  - @definitelytyped/utils@0.0.191

## 0.0.203

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/typescript-versions@0.0.183
  - @definitelytyped/header-parser@0.0.192
  - @definitelytyped/utils@0.0.190

## 0.0.202

### Patch Changes

- f53f17f6: Use package dependencies to manage TypeScript, instead of `$HOME/.dts`
- Updated dependencies [f53f17f6]
  - @definitelytyped/utils@0.0.189
  - @definitelytyped/header-parser@0.0.191

## 0.0.201

### Patch Changes

- 92b5cd51: Remove more tslint code to make dtslint work again

## 0.0.200

### Patch Changes

- 414ae487: Move npm-naming lint rule from tslint to eslint
- ae742dde: Special-case a useful error for `pnpm test` without arguments

## 0.0.199

### Patch Changes

- 30730f22: Use a direct require when finding estree import

## 0.0.198

### Patch Changes

- 3d6c2ffd: Port expect rule from tslint to eslint

## 0.0.197

### Patch Changes

- Updated dependencies [8288affb]
  - @definitelytyped/typescript-versions@0.0.182
  - @definitelytyped/header-parser@0.0.190
  - @definitelytyped/utils@0.0.188
  - @definitelytyped/dts-critic@0.0.191

## 0.0.196

### Patch Changes

- 59076828: Remove void-return, switch on no-invalid-void-type

## 0.0.195

### Patch Changes

- 6f685060: Port tslint builtins -> eslint

## 0.0.194

### Patch Changes

- Updated dependencies [85379bf8]
  - @definitelytyped/utils@0.0.187
  - @definitelytyped/header-parser@0.0.189
  - @definitelytyped/dts-critic@0.0.190

## 0.0.193

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/typescript-versions@0.0.181
  - @definitelytyped/header-parser@0.0.188
  - @definitelytyped/dts-critic@0.0.189
  - @definitelytyped/utils@0.0.186

## 0.0.192

### Patch Changes

- Updated dependencies [5d83a8ed]
- Updated dependencies [5d83a8ed]
  - @definitelytyped/utils@0.0.185
  - @definitelytyped/header-parser@0.0.187
  - @definitelytyped/dts-critic@0.0.188

## 0.0.191

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

- Updated dependencies [a18ce6b1]
  - @definitelytyped/header-parser@0.0.186
  - @definitelytyped/utils@0.0.184
  - @definitelytyped/dts-critic@0.0.187

## 0.0.190

### Patch Changes

- Updated dependencies [90e1d0ae]
  - @definitelytyped/typescript-versions@0.0.180
  - @definitelytyped/header-parser@0.0.185
  - @definitelytyped/utils@0.0.183
  - @definitelytyped/dts-critic@0.0.186

## 0.0.189

### Patch Changes

- Updated dependencies [f9e73605]
  - @definitelytyped/header-parser@0.0.184
  - @definitelytyped/dts-critic@0.0.185

## 0.0.188

### Patch Changes

- 1efaeab5: Fall back from `--module node16` when testing TS versions that don’t support it
- 95f31676: Mention package.json field, not header, when referring to minimumTypeScriptVersion
- Updated dependencies [2b3138a0]
  - @definitelytyped/utils@0.0.182
  - @definitelytyped/header-parser@0.0.183
  - @definitelytyped/dts-critic@0.0.184

## 0.0.187

### Patch Changes

- Updated dependencies [97f68d6e]
  - @definitelytyped/utils@0.0.181
  - @definitelytyped/header-parser@0.0.182
  - @definitelytyped/dts-critic@0.0.183

## 0.0.186

### Patch Changes

- Updated dependencies [d01cacd5]
  - @definitelytyped/utils@0.0.180
  - @definitelytyped/header-parser@0.0.181
  - @definitelytyped/dts-critic@0.0.182

## 0.0.185

### Patch Changes

- Updated dependencies [a5011acf]
  - @definitelytyped/dts-critic@0.0.181

## 0.0.184

### Patch Changes

- Updated dependencies [22ffaadf]
  - @definitelytyped/header-parser@0.0.180
  - @definitelytyped/dts-critic@0.0.180

## 0.0.183

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- 9fffa8ff: Fix entrypoint scripts to ensure they don’t run when being imported by an ES module
- Updated dependencies [024c3e73]
- Updated dependencies [9fffa8ff]
- Updated dependencies [9fffa8ff]
  - @definitelytyped/typescript-versions@0.0.179
  - @definitelytyped/header-parser@0.0.179
  - @definitelytyped/dts-critic@0.0.179
  - @definitelytyped/utils@0.0.179

## 0.0.182

### Patch Changes

- 7d60c4b6: Restore explicit disabling of no-redundant-jsdoc

## 0.0.181

### Patch Changes

- 38396dff: Remove no-redundant-jsdoc2 rule

## 0.0.180

### Patch Changes

- c1d8ff25: Port no-single-declare-module tslint->eslint

## 0.0.179

### Patch Changes

- 08cc565f: Port strict-export-declare-modifiers tslint->eslint

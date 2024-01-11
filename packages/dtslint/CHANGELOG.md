# @definitelytyped/dtslint

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

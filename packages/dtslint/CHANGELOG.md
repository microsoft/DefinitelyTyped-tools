# @definitelytyped/dtslint

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

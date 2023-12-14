# @definitelytyped/eslint-plugin

## 0.0.201

### Patch Changes

- @definitelytyped/utils@0.0.191
- @definitelytyped/dts-critic@0.0.195

## 0.0.200

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/dts-critic@0.0.194
  - @definitelytyped/utils@0.0.190

## 0.0.199

### Patch Changes

- Updated dependencies [f53f17f6]
  - @definitelytyped/utils@0.0.189
  - @definitelytyped/dts-critic@0.0.193

## 0.0.198

### Patch Changes

- 414ae487: Move npm-naming lint rule from tslint to eslint
- Updated dependencies [414ae487]
  - @definitelytyped/dts-critic@0.0.192

## 0.0.197

### Patch Changes

- 3d6c2ffd: Port expect rule from tslint to eslint

## 0.0.196

### Patch Changes

- 7805956b: Require eslint ^8.40.0 as peerDependency

## 0.0.195

### Patch Changes

- @definitelytyped/utils@0.0.188

## 0.0.194

### Patch Changes

- 59076828: Remove void-return, switch on no-invalid-void-type

## 0.0.193

### Patch Changes

- 0a3c2d5b: Fully type eslint plugin export and add metadata
- 7af66e7d: Handle `import = require()` in lint rules

## 0.0.192

### Patch Changes

- 6d711988: Fix error spans of various lint rules
- db9bf605: Fix incorrect ts-eslint peer deps
- ed3ce17d: Minor refactor for tests
- 6f685060: Port tslint builtins -> eslint

## 0.0.191

### Patch Changes

- Updated dependencies [85379bf8]
  - @definitelytyped/utils@0.0.187

## 0.0.190

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/utils@0.0.186

## 0.0.189

### Patch Changes

- Updated dependencies [5d83a8ed]
- Updated dependencies [5d83a8ed]
  - @definitelytyped/utils@0.0.185

## 0.0.188

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

- Updated dependencies [a18ce6b1]
  - @definitelytyped/utils@0.0.184

## 0.0.187

### Patch Changes

- @definitelytyped/utils@0.0.183

## 0.0.186

### Patch Changes

- ad779df9: fix: position of reporting ESLint rule no-unnecessary-generics

## 0.0.185

### Patch Changes

- 1efaeab5: Allow imports of dependencies that are also devDependencies
- Updated dependencies [2b3138a0]
  - @definitelytyped/utils@0.0.182

## 0.0.184

### Patch Changes

- Updated dependencies [97f68d6e]
  - @definitelytyped/utils@0.0.181
  - @definitelytyped/header-parser@0.0.182

## 0.0.183

### Patch Changes

- Updated dependencies [d01cacd5]
  - @definitelytyped/utils@0.0.180
  - @definitelytyped/header-parser@0.0.181

## 0.0.182

### Patch Changes

- Updated dependencies [22ffaadf]
  - @definitelytyped/header-parser@0.0.180

## 0.0.181

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- Updated dependencies [024c3e73]
- Updated dependencies [9fffa8ff]
  - @definitelytyped/header-parser@0.0.179
  - @definitelytyped/utils@0.0.179

## 0.0.180

### Patch Changes

- c1d8ff25: Port no-single-declare-module tslint->eslint

## 0.0.179

### Patch Changes

- 08cc565f: Port strict-export-declare-modifiers tslint->eslint

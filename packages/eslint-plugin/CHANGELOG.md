# @definitelytyped/eslint-plugin

## 0.1.15

### Patch Changes

- 6dd1778: Re-fix ExpectType
- 2a6318d: Bump typescript-eslint to v7
- 2a6318d: Bump TypeScript to 5.5
- Updated dependencies [2a6318d]
  - @definitelytyped/utils@0.1.7

## 0.1.14

### Patch Changes

- 5476570: Revert ExpectType bugfix

## 0.1.13

### Patch Changes

- c3d86f3: Fix ExpectType with extra whitespace

## 0.1.12

### Patch Changes

- Updated dependencies [f014cc6]
  - @definitelytyped/utils@0.1.6

## 0.1.11

### Patch Changes

- adfd769: Allow packages to test multiple tsconfigs by specifying list of tsconfigs in package.json

## 0.1.10

### Patch Changes

- 946d3d4: Update for TS 5.4

## 0.1.9

### Patch Changes

- 5dae397: Switch expect to using settings for versionsToTest

## 0.1.8

### Patch Changes

- e9b73e3: Don't complain about 'export import =' in strict-export-declare-modifiers

## 0.1.7

### Patch Changes

- Updated dependencies [b287cf9]
  - @definitelytyped/utils@0.1.5

## 0.1.6

### Patch Changes

- 5e7da60: Fix compatibility with Windows
- Updated dependencies [5e7da60]
  - @definitelytyped/utils@0.1.4

## 0.1.5

### Patch Changes

- Updated dependencies [e2aef2f]
  - @definitelytyped/utils@0.1.3

## 0.1.4

### Patch Changes

- Updated dependencies [31de5d3]
- Updated dependencies [9da3fc7]
  - @definitelytyped/utils@0.1.2

## 0.1.3

### Patch Changes

- 4216821: Add @arethetypeswrong/cli run

## 0.1.2

### Patch Changes

- Updated dependencies [0f0a785]
  - @definitelytyped/dts-critic@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [aa08460]
- Updated dependencies [aa08460]
  - @definitelytyped/utils@0.1.1
  - @definitelytyped/dts-critic@0.1.1

## 0.1.0

### Minor Changes

- 2d7a5d3: Require Node 18+

### Patch Changes

- Updated dependencies [2d7a5d3]
  - @definitelytyped/dts-critic@0.1.0
  - @definitelytyped/utils@0.1.0

## 0.0.208

### Patch Changes

- 2c3e5de: Update dependencies
- e7ce84f: Fix case sensitivity of node16 backwards compat
- Updated dependencies [2c3e5de]
  - @definitelytyped/dts-critic@0.0.199
  - @definitelytyped/utils@0.0.192

## 0.0.207

### Patch Changes

- 57628b68: Add new no-type-only-packages lint rule

## 0.0.206

### Patch Changes

- 55f05a86: Clean up expect type code for diagnostics

## 0.0.205

### Patch Changes

- 20d5c884: Run Expect on all files in CI

## 0.0.204

### Patch Changes

- 1a5fdc83: Remove test files from packages
- Updated dependencies [1a5fdc83]
  - @definitelytyped/dts-critic@0.0.198

## 0.0.203

### Patch Changes

- @definitelytyped/dts-critic@0.0.197

## 0.0.202

### Patch Changes

- @definitelytyped/dts-critic@0.0.196

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

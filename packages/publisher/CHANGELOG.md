# @definitelytyped/publisher

## 0.0.198

### Patch Changes

- @definitelytyped/definitions-parser@0.0.198
- @definitelytyped/header-parser@0.0.193
- @definitelytyped/retag@0.0.198
- @definitelytyped/utils@0.0.191

## 0.0.197

### Patch Changes

- b980f717: Rename branch to main
- Updated dependencies [b980f717]
  - @definitelytyped/definitions-parser@0.0.197
  - @definitelytyped/header-parser@0.0.192
  - @definitelytyped/retag@0.0.197
  - @definitelytyped/utils@0.0.190

## 0.0.196

### Patch Changes

- Updated dependencies [f53f17f6]
  - @definitelytyped/utils@0.0.189
  - @definitelytyped/definitions-parser@0.0.196
  - @definitelytyped/header-parser@0.0.191
  - @definitelytyped/retag@0.0.196

## 0.0.195

### Patch Changes

- @definitelytyped/definitions-parser@0.0.195
- @definitelytyped/header-parser@0.0.190
- @definitelytyped/retag@0.0.195
- @definitelytyped/utils@0.0.188

## 0.0.194

### Patch Changes

- Updated dependencies [926d5ab0]
  - @definitelytyped/definitions-parser@0.0.194
  - @definitelytyped/retag@0.0.194

## 0.0.193

### Patch Changes

- Updated dependencies [85379bf8]
  - @definitelytyped/utils@0.0.187
  - @definitelytyped/definitions-parser@0.0.193
  - @definitelytyped/header-parser@0.0.189
  - @definitelytyped/retag@0.0.193

## 0.0.192

### Patch Changes

- 5b0559f6: Update and clean up dependencies
- Updated dependencies [5b0559f6]
  - @definitelytyped/definitions-parser@0.0.192
  - @definitelytyped/header-parser@0.0.188
  - @definitelytyped/retag@0.0.192
  - @definitelytyped/utils@0.0.186

## 0.0.191

### Patch Changes

- 5d83a8ed: Fix command execution, paths on Windows
- Updated dependencies [5d83a8ed]
- Updated dependencies [5d83a8ed]
  - @definitelytyped/utils@0.0.185
  - @definitelytyped/definitions-parser@0.0.191
  - @definitelytyped/header-parser@0.0.187
  - @definitelytyped/retag@0.0.191

## 0.0.190

### Patch Changes

- Updated dependencies [8272a9d2]
  - @definitelytyped/definitions-parser@0.0.190
  - @definitelytyped/retag@0.0.190

## 0.0.189

### Patch Changes

- a18ce6b1: Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

  Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
  Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

  While not used for automated package publishing, an `.npmignore` is now required in each package.
  This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

- Updated dependencies [a18ce6b1]
  - @definitelytyped/definitions-parser@0.0.189
  - @definitelytyped/header-parser@0.0.186
  - @definitelytyped/utils@0.0.184
  - @definitelytyped/retag@0.0.189

## 0.0.188

### Patch Changes

- @definitelytyped/definitions-parser@0.0.188
- @definitelytyped/header-parser@0.0.185
- @definitelytyped/retag@0.0.188
- @definitelytyped/utils@0.0.183

## 0.0.187

### Patch Changes

- Updated dependencies [046ac38e]
  - @definitelytyped/definitions-parser@0.0.187
  - @definitelytyped/retag@0.0.187

## 0.0.186

### Patch Changes

- Updated dependencies [f9e73605]
  - @definitelytyped/header-parser@0.0.184
  - @definitelytyped/definitions-parser@0.0.186
  - @definitelytyped/retag@0.0.186

## 0.0.185

### Patch Changes

- Updated dependencies [2b3138a0]
- Updated dependencies [c0b13e4b]
  - @definitelytyped/utils@0.0.182
  - @definitelytyped/definitions-parser@0.0.185
  - @definitelytyped/header-parser@0.0.183
  - @definitelytyped/retag@0.0.185

## 0.0.184

### Patch Changes

- 97f68d6e: Fix one more missing corepack issue, env in exec util
- Updated dependencies [c8d8b1f8]
- Updated dependencies [97f68d6e]
  - @definitelytyped/definitions-parser@0.0.184
  - @definitelytyped/utils@0.0.181
  - @definitelytyped/retag@0.0.184
  - @definitelytyped/header-parser@0.0.182

## 0.0.183

### Patch Changes

- d01cacd5: Make AllPackages lazy and asynchronous
- Updated dependencies [d01cacd5]
  - @definitelytyped/definitions-parser@0.0.183
  - @definitelytyped/retag@0.0.183
  - @definitelytyped/utils@0.0.180
  - @definitelytyped/header-parser@0.0.181

## 0.0.182

### Patch Changes

- Updated dependencies [13922c30]
  - @definitelytyped/definitions-parser@0.0.182
  - @definitelytyped/retag@0.0.182

## 0.0.181

### Patch Changes

- 22ffaadf: Always convert contributor githubUsername to url (missing changeset)
- Updated dependencies [8cae0671]
- Updated dependencies [22ffaadf]
  - @definitelytyped/definitions-parser@0.0.181
  - @definitelytyped/header-parser@0.0.180
  - @definitelytyped/retag@0.0.181

## 0.0.180

### Patch Changes

- ddbece90: Restore parseDefinitions in publisher/full.ts
- Updated dependencies [3c8512ad]
  - @definitelytyped/definitions-parser@0.0.180
  - @definitelytyped/retag@0.0.180

## 0.0.179

### Patch Changes

- 024c3e73: Update @definitelytyped for Definitely Typed's monorepo upgrade
- 9fffa8ff: Fix entrypoint scripts to ensure they don’t run when being imported by an ES module
- Updated dependencies [024c3e73]
- Updated dependencies [9fffa8ff]
- Updated dependencies [9fffa8ff]
  - @definitelytyped/typescript-versions@0.0.179
  - @definitelytyped/definitions-parser@0.0.179
  - @definitelytyped/header-parser@0.0.179
  - @definitelytyped/retag@0.0.179
  - @definitelytyped/utils@0.0.179

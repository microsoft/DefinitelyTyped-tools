---
"@definitelytyped/definitions-parser": patch
"@definitelytyped/eslint-plugin": patch
"@definitelytyped/header-parser": patch
"@definitelytyped/publisher": patch
"@definitelytyped/dtslint": patch
"@definitelytyped/utils": patch
---

Remove use of module resolution and OTHER_FILES, instead include all dts files in packages

Files in packages are no longer determined by import resolution stemming from `index.d.ts` and tests (along with those listed in `OTHER_FILES.txt`).
Instead, all files matching the glob `**/*.d.{ts,cts,mts,*.d.ts}` are included in the package, excluding those inside of versioned subdirectories.

While not used for automated package publishing, an `.npmignore` is now required in each package.
This allows for one-off `npm pack`-ing of packages, such that external tooling can get a rough approximation of what will be published for analysis.

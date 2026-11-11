---
"@definitelytyped/utils": minor
"@definitelytyped/dtslint-runner": patch
"@definitelytyped/eslint-plugin": patch
---

Remove the unused suggestions-file subsystem and its cache-directory dependency.
The utilities package no longer exports `suggestionsDir`, and the runner no longer prints the obsolete suggestions section.



A valid definition library can be in one of the following forms:

* *global*
  * Declares types or values in the global namespace
  * Does not contain external ambient module declarations
  * May not contain `import` declarations

* *UMD*
  * Contains a module global export declaration (e.g. `export as namespace foo`)
  * Has top-level export declarations
  * May optionally have a `declare global {}` block

* *module*
  * Has top-level export declarations
  * May optionally have a `declare global {}` block


Additionally, compliant definitions must comply with the following:
 * No `/// <reference path="filename" />` directives starting with `../`
 * 
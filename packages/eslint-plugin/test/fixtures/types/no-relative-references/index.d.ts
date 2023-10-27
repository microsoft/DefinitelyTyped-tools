/// <reference path="../foo/index.d.ts" />
/// <reference path="./v1/index.d.ts" />
/// <reference path="../foo/v1/index.d.ts" />

import * as foo from "../foo";
import * as foo2 from "./v1";
import * as foo3 from "../foo/v1";

declare module "no-relative-references" {
  import A = require("no-relative-references/blah"); // Okay; relative
  import B = require("no-relative-references/v1"); // Bad; versioned subdir
}

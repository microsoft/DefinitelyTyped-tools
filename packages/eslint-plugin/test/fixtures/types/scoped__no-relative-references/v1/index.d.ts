/// <reference path="../../foo/index.d.ts" />
/// <reference path="../v1/index.d.ts" />
/// <reference path="../../foo/v1/index.d.ts" />
/// <reference path="../index.d.ts" />

import * as foo from "../../foo";
import * as foo2 from "../v1";
import * as foo3 from "../../foo/v1";
import * as va4 from "../index";

declare module "@scoped/no-relative-references" {
  import A = require("@scoped/no-relative-references/blah"); // Okay; relative
  import B = require("@scoped/no-relative-references/v1"); // Okay; no versioned dir here
  import C = require("../index"); // Bad; parent dir
}

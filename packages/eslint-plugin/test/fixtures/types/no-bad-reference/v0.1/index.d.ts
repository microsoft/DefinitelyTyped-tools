/// <reference path="../../foo/index.d.ts" />
/// <reference path="../v1/index.d.ts" />
/// <reference path="../../foo/v0.1/index.d.ts" />
/// <reference path="../index.d.ts" />

import * as foo from "../../foo";
import * as foo2 from "../v0.1";
import * as foo3 from "../../foo/v0.1";
import * as va4 from "../index";

declare module "no-relative-references" {
  import A = require("no-relative-references/blah"); // Okay; relative
  import B = require("no-relative-references/v0.1"); // Okay; no versioned dir here
  import C = require("../index"); // Bad; parent dir
}

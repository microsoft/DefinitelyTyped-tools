import myself from "no-self-import";
import abc from "no-self-import/abc.d.ts"

import old1 from "./v11";
import old2 from "./v11/index";
import old3 from "./v11/subdir/file";
import old4 from "./v0.1"
import old5 from "./v0.1/index"

import myselfRequired = require("no-self-import");
import abcRequired = require("no-self-import/abc.d.ts");

import old1Required = require("./v11");
import old2Required = require("./v11/index");
import old3Required = require("./v11/subdir/file");
import old4Required = require("./v0.1");
import old5Required = require("./v0.1/index");

/// <reference types="devdep"/>
/// <reference types="otherdevdep"/>
/// <reference types="other"/>

import other from "other";
import self from "no-import-of-dev-dependencies";

import devdep from "devdep";
import * as otherdevdep from "otherdevdep";

import otherRequired = require("other");
import selfRequired = require("no-import-of-dev-dependencies");

import devdepRequired = require("devdep");
import otherdevdepRequired = require("otherdevdep");

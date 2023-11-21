/// <reference types="devdep"/>
/// <reference types="otherdevdep"/>
/// <reference types="other"/>

import other from "other";
import self from "no-import-of-dev-dependencies";

import devdep from "devdep";
import * as otherdevdep from "otherdevdep";

import other2 = require("other");
import self2 = require("no-import-of-dev-dependencies");

import devdep2 = require("devdep");
import otherdevdep2 = require("otherdevdep");

import { ESLint } from "eslint";
import { all } from "./configs/all";
import { rules } from "./rules/index";

const packageJson = require("../package.json");

const plugin: ESLint.Plugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  configs: {
    all,
  },
  rules: rules as any,
};

export = plugin;

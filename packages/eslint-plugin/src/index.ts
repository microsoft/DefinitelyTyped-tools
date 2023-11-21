import { ESLint } from "eslint";
import { all } from "./configs/all";
import { rules } from "./rules/index";

const plugin: ESLint.Plugin = {
  meta: {
    name: "@definitelytyped/eslint-plugin",
    version: require("../package.json").version,
  },
  configs: {
    all,
  },
  rules: rules as any,
};

export = plugin;

import { rules } from "../rules/index.js";

export const overrides = [
  {
    files: ["*.cts", "*.mts", "*.ts", "*.tsx"],
    plugins: ["@definitelytyped"],
    rules: Object.fromEntries(Object.keys(rules).map((name) => [`@definitelytyped/${name}`, "error"])),
  },
];

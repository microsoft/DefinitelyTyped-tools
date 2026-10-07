import { spawnSync } from "node:child_process";
import { existsSync, globSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = dirname(fileURLToPath(import.meta.url));
const { positionals, tokens } = parseArgs({
  allowPositionals: true,
  strict: false,
  tokens: true,
  options: Object.fromEntries(
    [
      "test-concurrency",
      "test-coverage-branches",
      "test-coverage-functions",
      "test-coverage-lines",
      "test-global-setup",
      "test-isolation",
      "test-name-pattern",
      "test-reporter",
      "test-reporter-destination",
      "test-shard",
      "test-skip-pattern",
      "test-timeout",
    ].map((name) => [name, { type: "string" }]),
  ),
});
const filters = positionals.map((input) =>
  (existsSync(resolve(input)) ? relative(root, resolve(input)) : input).replaceAll("\\", "/"),
);
const files = [
  ...globSync(
    ["packages/*/test/**/*.test.ts", "packages/dts-critic/*.test.ts", "packages/mergebot/src/_tests/*.test.ts"],
    { cwd: root, exclude: ["**/fixtures/**", "**/testsource/**", "**/dist/**", "packages/publisher/output/**"] },
  ),
].filter((file) => !filters.length || filters.some((filter) => file.replaceAll("\\", "/").includes(filter)));
if (!files.length) throw new Error(`No test files match: ${positionals.join(", ")}`);
const flags = tokens
  .filter((token) => token.kind === "option")
  .map((token) => token.rawName + (token.value === undefined ? "" : `=${token.value}`));
const result = spawnSync(
  process.execPath,
  ["--import", import.meta.resolve("tsx"), "--require", "./test-setup.cjs", "--test", ...flags, ...files],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.signal) throw new Error(`Test runner terminated by ${result.signal}`);
if (result.status === null) throw new Error("Test runner did not exit normally");
process.exitCode = result.status;

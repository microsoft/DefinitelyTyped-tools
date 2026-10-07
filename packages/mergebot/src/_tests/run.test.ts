import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { inspect } from "node:util";

const runPath = resolve("packages/mergebot/dist/run.js");
const clientPath = resolve("packages/mergebot/dist/graphql-client.js");
const rawResult = { data: { repository: { pullRequest: null } } };

function run(...args: string[]) {
  const script = `
const { mock } = require("node:test");
mock.method(globalThis, "fetch", async () => {
  throw new Error("Unexpected network request");
});
const { client } = require(${JSON.stringify(clientPath)});
mock.method(client, "query", async ({ query }) => {
  const name = query.definitions[0].name.value;
  if (name === "GetAllOpenPRs") {
    return { data: { repository: { pullRequests: {
      nodes: [{ number: 42 }],
      pageInfo: { hasNextPage: false },
    } } } };
  }
  if (name === "PR") return ${JSON.stringify(rawResult)};
  throw new Error("Unexpected query: " + name);
});
process.argv = [process.execPath, ${JSON.stringify(runPath)}, ...${JSON.stringify(args)}];
require(${JSON.stringify(runPath)});
`;
  return spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, BOT_AUTH_TOKEN: "FAKE_TOKEN" },
  });
}

describe("mergebot CLI formatting", () => {
  it("advertises only JSON and Node formats", () => {
    const result = run("--help");
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /choices: "json", "node"/);
    assert.ok(!result.stdout.includes("yaml"));
    assert.ok(!result.stdout.includes("Getting open PRs."));
  });

  it("rejects the retired YAML format before running queries", () => {
    const result = run("--format", "yaml");
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid values/);
    assert.match(result.stderr, /Argument: format/);
    assert.match(result.stderr, /yaml/);
    assert.ok(!result.stdout.includes("Getting open PRs."));
  });

  for (const format of [undefined, "json", "node"] as const) {
    it(`preserves ${format ?? "default Node"} output`, () => {
      const args = ["--dry", "--no-cleanup", "--show-raw"];
      if (format) args.push("--format", format);
      const result = run(...args);
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      const formatted =
        format === "json" ? JSON.stringify(rawResult, undefined, 2) : inspect(rawResult, { depth: null, colors: true });
      const output = result.stdout.split("  === Raw Query Result ===\n");
      assert.equal(output.length, 2);
      assert.equal(output[1], formatted.replace(/^/gm, "  ") + "\n");
    });
  }
});

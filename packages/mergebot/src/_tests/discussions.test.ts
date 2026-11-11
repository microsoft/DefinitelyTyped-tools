import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canHandleRequest, extractNPMReference } from "../discussions";

describe(canHandleRequest.name, { concurrency: true }, () => {
  const eventActions = [
    ["discussion", "created", true],
    ["discussion", "edited", true],
    ["discussion", "updated", false],
    ["pull_request", "created", false],
  ] as const;

  for (const row of eventActions) {
    test(`(${row[0]}, ${row[1]}) is ${row[2]}`, async () => {
      const [event, action, expected] = row;
      assert.deepEqual(canHandleRequest(event, action), expected);
    });
  }
});

describe(extractNPMReference.name, { concurrency: true }, () => {
  const eventActions = [
    ["[node] my thingy", "node"],
    ["OK [react]", "react"],
    ["I  think [@typescript/twoslash] need improving ", "@typescript/twoslash"],
    ["[@types/node] needs X", "node"],
  ] as const;

  for (const row of eventActions) {
    test(`${row[0]} is ${row[1]}`, async () => {
      const [title, result] = row;
      assert.deepEqual(extractNPMReference({ title }), result);
    });
  }

  const invalid = [
    "[Pkg: foo] inject", // space disallowed
    "[node @attacker] hi", // space + invalid char
    "[FOO] uppercase not allowed in npm names",
    "[../etc/passwd] traversal",
    "[]", // empty
    "[ leading-space]",
    "[trailing-space ]",
    "[has\nnewline]",
  ];
  for (const row of invalid) {
    test(`rejects invalid title ${JSON.stringify(row)}`, async () => {
      const title = row;
      assert.equal(extractNPMReference({ title }), undefined);
    });
  }
});

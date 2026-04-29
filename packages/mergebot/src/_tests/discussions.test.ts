/// <reference types="jest" />
import { canHandleRequest, extractNPMReference } from "../discussions";

describe(canHandleRequest, () => {
  const eventActions = [
    ["discussion", "created", true],
    ["discussion", "edited", true],
    ["discussion", "updated", false],
    ["pull_request", "created", false],
  ] as const;

  test.concurrent.each(eventActions)("(%s, %s) is %s", async (event, action, expected) => {
    expect(canHandleRequest(event, action)).toEqual(expected);
  });
});

describe(extractNPMReference, () => {
  const eventActions = [
    ["[node] my thingy", "node"],
    ["OK [react]", "react"],
    ["I  think [@typescript/twoslash] need improving ", "@typescript/twoslash"],
    ["[@types/node] needs X", "node"],
  ] as const;

  test.concurrent.each(eventActions)("(%s, %s) is %s", async (title, result) => {
    expect(extractNPMReference({ title })).toEqual(result);
  });

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
  test.concurrent.each(invalid)("rejects invalid title %p", async (title) => {
    expect(extractNPMReference({ title })).toBeUndefined();
  });
});

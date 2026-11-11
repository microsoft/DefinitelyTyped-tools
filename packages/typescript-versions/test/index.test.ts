import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TypeScriptVersion } from "../index";

describe("unsupported", () => {
  it("contains at least 2.9", () => {
    assert.ok(TypeScriptVersion.unsupported.includes("2.9"));
  });
});

describe("all", () => {
  it("doesn't have any holes", () => {
    let prev = TypeScriptVersion.all[0];
    for (const version of TypeScriptVersion.all.slice(1)) {
      const [prevMajor, prevMinor] = prev.split(".").map(Number);
      const [major, minor] = version.split(".").map(Number);
      assert.ok((major === prevMajor && minor === prevMinor + 1) || (major === prevMajor + 1 && minor === 0));
      prev = version;
    }
  });
});

describe("isSupported", () => {
  it("works", () => {
    assert.ok(TypeScriptVersion.isSupported("5.9"));
  });
  it("supports 5.6", () => {
    assert.ok(TypeScriptVersion.isSupported("5.6"));
  });
  it("does not support 4.0", () => {
    assert.ok(!TypeScriptVersion.isSupported("4.0"));
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    assert.ok(TypeScriptVersion.isTypeScriptVersion("5.6"));
  });
  it("rejects out-of-range", () => {
    assert.ok(!TypeScriptVersion.isTypeScriptVersion("101.1"));
  });
  it("rejects garbage", () => {
    assert.ok(!TypeScriptVersion.isTypeScriptVersion("it'sa me, luigi"));
  });
});

describe("range", () => {
  it("works", () => {
    assert.deepEqual(TypeScriptVersion.range("5.6"), ["5.6", "5.7", "5.8", "5.9", "6.0", "7.0", "7.1"]);
  });
  it("includes 5.6 onwards", () => {
    assert.deepEqual(TypeScriptVersion.range("5.6"), TypeScriptVersion.supported);
  });
});

describe("compare", () => {
  it("uses the declared version order", () => {
    assert.ok(TypeScriptVersion.compare("7.0", "7.1") < 0);
    assert.ok(TypeScriptVersion.compare("7.1", "7.0") > 0);
    assert.equal(TypeScriptVersion.compare("7.1", "7.1"), 0);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    assert.deepEqual(TypeScriptVersion.tagsToUpdate("5.6"), [
      "ts5.6",
      "ts5.7",
      "ts5.8",
      "ts5.9",
      "ts6.0",
      "ts7.0",
      "ts7.1",
      "latest",
    ]);
  });
  it("allows 5.6 onwards", () => {
    assert.deepEqual(
      TypeScriptVersion.tagsToUpdate("5.6"),
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest"),
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { resolve } from "../src";

describe("package.json", () => {
  it("must contain correct dependencies", () => {
    const dependencies = require("../package.json").dependencies as Record<string, string>;
    const typescripts = new Map<string, string>(
      Object.entries(dependencies).filter(([name]) => name.startsWith("typescript-")),
    );

    for (const version of TypeScriptVersion.supported) {
      const name = `typescript-${version}`;
      const entry = typescripts.get(name);
      assert.equal(entry, `npm:typescript@~${version}.0-0`);
      typescripts.delete(name);
    }

    assert.deepEqual([...typescripts], []);
  });
});

describe("resolve", () => {
  it("resolves to the right version", () => {
    for (const version of TypeScriptVersion.supported) {
      const ts = require(resolve(version));
      assert.equal(typeof ts.versionMajorMinor, "string");
      if (version === "7.1") {
        assert.match(ts.version, /^7\.1\./);
      } else {
        assert.equal(ts.versionMajorMinor, version);
      }
      if (version.startsWith("7.")) {
        assert.match(resolve(version, version === "7.0" ? "unstable/sync" : "sync"), /api[\\/]sync[\\/]api\.js$/);
      }
    }
  });
});

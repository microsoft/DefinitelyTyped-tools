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
      expect(entry).toBe(`npm:typescript@~${version}.0-0`);
      typescripts.delete(name);
    }

    expect([...typescripts]).toStrictEqual([]);
  });
});

describe("resolve", () => {
  it("resolves to the right version", () => {
    for (const version of TypeScriptVersion.supported) {
      const ts = require(resolve(version));
      expect(typeof ts.versionMajorMinor).toBe("string");
      if (version === "7.1") {
        expect(ts.version).toMatch(/^7\.1\./);
      } else {
        expect(ts.versionMajorMinor).toBe(version);
      }
      if (version.startsWith("7.")) {
        expect(resolve(version, "unstable/sync")).toMatch(/api[\\/]sync[\\/]api\.js$/);
      }
    }
  });
});

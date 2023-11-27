import { versions, resolve } from "../src";

describe("package.json", () => {
  it("must contain correct dependencies", () => {
    const dependencies = require("../package.json").dependencies as Record<string, string>;
    const typescripts = new Map<string, string>(
      Object.entries(dependencies).filter(([name]) => name.startsWith("typescript-")),
    );

    for (const version of versions) {
      const name = `typescript-${version}`;
      expect(typescripts.get(name)).toBe(`npm:typescript@${version === "next" ? "next" : `~${version}`}`);
      typescripts.delete(name);
    }

    expect(typescripts.size).toBe(0);
  });
});

describe("resolve", () => {
  it("resolves to the right version", () => {
    for (const version of versions) {
      const ts = require(resolve(version));
      expect(typeof ts.versionMajorMinor).toBe("string");
      if (version !== "next") {
        expect(ts.versionMajorMinor).toBe(version);
      }
    }
  });
});

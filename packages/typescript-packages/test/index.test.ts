import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import { resolve } from "../src";

describe("package.json", () => {
  it("must contain correct dependencies", () => {
    const dependencies = require("../package.json").dependencies as Record<string, string>;
    const typescripts = new Map<string, string>(
      Object.entries(dependencies).filter(([name]) => name.startsWith("typescript-")),
    );

    function getAndDeleteEntry(name: string): string {
      name = `typescript-${name}`;
      const version = typescripts.get(name);
      expect(version).toBeTruthy();
      typescripts.delete(name);
      return version!;
    }

    for (const version of TypeScriptVersion.shipped) {
      expect(getAndDeleteEntry(version)).toBe(`npm:typescript@~${version}`);
    }

    const unshipped = TypeScriptVersion.supported.slice(TypeScriptVersion.shipped.length);
    switch (unshipped.length) {
      case 1:
        // If there's only one unshipped version, it's next.
        const next = unshipped[0];
        expect(getAndDeleteEntry(next)).toBe(`npm:typescript@next`);
        break;
      case 2:
        // If there are two unshipped versions, the first is next and the second is beta.
        const [rc, beta] = unshipped;
        expect(getAndDeleteEntry(rc)).toBe(`npm:typescript@next`);
        expect(getAndDeleteEntry(beta)).toBe(`npm:typescript@beta`);
        break;
      default:
        throw new Error(`Unexpected number of unshipped versions: ${unshipped.length}`);
    }

    expect([...typescripts]).toStrictEqual([]);
  });
});

describe("resolve", () => {
  it("resolves to the right version", () => {
    for (const version of TypeScriptVersion.supported) {
      const ts = require(resolve(version));
      expect(typeof ts.versionMajorMinor).toBe("string");
      expect(ts.versionMajorMinor).toBe(version);
    }
  });
});

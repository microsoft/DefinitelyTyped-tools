import { createModuleResolutionHost, InMemoryFS, Dir } from "../src/fs";

describe("fs", () => {
  describe("createModuleResolutionHost", () => {
    it("can ignore files above a given directory", () => {
      // a/
      //  a.ts
      //  b/
      //   b.ts
      const dirA = new Dir(undefined);
      const dirB = new Dir(dirA);
      dirA.set("a.ts", "a");
      dirA.set("b", dirB);
      dirB.set("b.ts", "b");
      const rootFs = new InMemoryFS(dirA, "/a/");
      const host = createModuleResolutionHost(rootFs, /*ignoreFilesAboveDirectory*/ "/a/b");

      expect(rootFs.exists("/a/a.ts")).toBe(true);
      expect(rootFs.exists("/a/b/b.ts")).toBe(true);

      expect(host.fileExists("/a/a.ts")).toBe(false); // <-- ignored
      expect(host.fileExists("/a/b/b.ts")).toBe(true);
    });
  });
});

import assert from "node:assert/strict";
import {} from "node:test";
import { getDefinitelyTyped } from "../get-definitely-typed";
import { quietLoggerWithErrors, Dir, FS, InMemoryFS } from "@definitelytyped/utils";
import { testo } from "./utils";

testo({
  async downloadDefinitelyTyped() {
    const dt = await getDefinitelyTyped(
      {
        definitelyTypedPath: undefined,
        progress: false,
      },
      quietLoggerWithErrors()[0],
    );
    assert.equal(dt.exists("types"), true);
    assert.equal(dt.exists("buncho"), false);
  },
  createDirs() {
    const root = new Dir(undefined);
    root.set("file1.txt", "ok");
    assert.equal(root.has("file1.txt"), true);
    assert.equal(root.get("file1.txt"), "ok");
  },
  simpleMemoryFS() {
    const root = new Dir(undefined);
    root.set("file1.txt", "ok");
    const dir = root.subdir("sub1");
    dir.set("file2.txt", "x");
    const fs: FS = new InMemoryFS(root, "/test/");
    assert.equal(fs.exists("file1.txt"), true);
    assert.equal(fs.readFile("file1.txt"), "ok");
    assert.equal(fs.readFile("sub1/file2.txt"), "x");
  },
});

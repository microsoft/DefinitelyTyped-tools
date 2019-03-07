import { Dir, FS, getDefinitelyTyped, InMemoryDT } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { loggerWithErrors } from "./util/logging";
import { testo } from "./util/test";

testo({
    async downloadDefinitelyTyped() {
        const dt = await getDefinitelyTyped(Options.azure, loggerWithErrors()[0]);
        expect(await dt.exists("types")).toBe(true);
        expect(await dt.exists("buncho")).toBe(false);
    },
    createDirs() {
        const root = new Dir(undefined);
        root.set("file1.txt", "ok");
        expect(root.has("file1.txt")).toBe(true);
        expect(root.get("file1.txt")).toBe("ok");
    },
    simpleMemoryFS() {
        const root = new Dir(undefined);
        root.set("file1.txt", "ok");
        const dir = root.subdir("sub1");
        dir.set("file2.txt", "x");
        const fs: FS = new InMemoryDT(root, "test/");
        expect(fs.exists("file1.txt")).toBe(true);
        expect(fs.readFile("file1.txt")).toBe("ok");
        expect(fs.readFile("sub1/file2.txt")).toBe("x");
    },
});

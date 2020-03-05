import { getDefinitelyTyped } from "../src/get-definitely-typed";
import { loggerWithErrors, Dir, FS, InMemoryFS } from "@definitelytyped/utils";
import { testo } from "./utils";

testo({
    async downloadDefinitelyTyped() {
        const dt = await getDefinitelyTyped({
            definitelyTypedPath: undefined,
            parseInParallel: false,
            progress: false,
        }, loggerWithErrors()[0]);
        expect(dt.exists("types")).toBe(true);
        expect(dt.exists("buncho")).toBe(false);
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
        const fs: FS = new InMemoryFS(root, "test/");
        expect(fs.exists("file1.txt")).toBe(true);
        expect(fs.readFile("file1.txt")).toBe("ok");
        expect(fs.readFile("sub1/file2.txt")).toBe("x");
    },
});

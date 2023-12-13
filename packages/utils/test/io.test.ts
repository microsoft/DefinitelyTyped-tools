import path from "path";
import fs from "fs";
import { list } from "tar";
import { createTgz } from "../src/io";

describe("io", () => {
  describe(createTgz, () => {
    it("packs a directory", (done) => {
      const dir = path.join(__dirname, "data", "pack");
      const archivePath = path.join(__dirname, "data", "pack.tgz");

      createTgz(dir, (err) => {
        throw err;
      })
        .pipe(fs.createWriteStream(archivePath))
        .on("finish", async () => {
          expect(fs.existsSync(archivePath)).toBe(true);
          const entries: string[] = [];
          await list({ file: archivePath, onentry: (e) => entries.push(e.path) });
          expect(entries[0]).toBe("pack/");
          expect(entries[1]).toBe("pack/test.txt");
          done();
        });
    });
  });
});

import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { EventEmitter } from "events";
import { list } from "tar";
import tarStream from "tar-stream";
import { createTgz, createGitHubStringSetGetter, stringOfStream, streamOfString } from "../src/io";

describe("io", () => {
  describe(stringOfStream, () => {
    it("reads Node.js streams", async () => {
      await expect(stringOfStream(streamOfString("contents"), "test")).resolves.toBe("contents");
    });

    it("reads tar-stream entries", async () => {
      const pack = tarStream.pack();
      const extract = tarStream.extract();
      const result = new Promise<string>((resolve, reject) => {
        extract.on("error", reject);
        extract.on("entry", (header, stream, next) => {
          stringOfStream(stream, header.name).then((text) => {
            next();
            resolve(text);
          }, reject);
        });
      });
      pack.pipe(extract);
      pack.entry({ name: "test.txt" }, "contents");
      pack.finalize();
      await expect(result).resolves.toBe("contents");
    });
  });

  describe(createGitHubStringSetGetter, () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let fallbackPath: string;
    let getSpy: jest.SpyInstance;

    beforeEach(() => {
      // Force the network path (skipped when NODE_ENV === "test").
      process.env.NODE_ENV = "production";
      fallbackPath = path.join(os.tmpdir(), `gh-string-set-getter-${Date.now()}.txt`);
      fs.writeFileSync(fallbackPath, "local-a\nlocal-b\n");
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      getSpy?.mockRestore();
      if (fs.existsSync(fallbackPath)) {
        fs.unlinkSync(fallbackPath);
      }
    });

    function mockHttpsGet(statusCode: number, body: string): void {
      getSpy = jest.spyOn(https, "get").mockImplementation(((_url: unknown, cb: (res: unknown) => void) => {
        const res = new EventEmitter() as EventEmitter & { statusCode: number };
        res.statusCode = statusCode;
        process.nextTick(() => {
          res.emit("data", body);
          res.emit("end");
        });
        cb(res);
        return new EventEmitter();
      }) as unknown as typeof https.get);
    }

    it("falls back to the local copy when GitHub responds with a non-2xx status", async () => {
      // Regression test: a rate-limited/errored response body must not be parsed as the file.
      mockHttpsGet(429, "429: Too Many Requests\nrate limit exceeded");
      const getter = createGitHubStringSetGetter("some/path.txt", fallbackPath);
      const result = await getter();
      expect(result).toEqual(new Set(["local-a", "local-b", ""]));
      expect(result.has("429: Too Many Requests")).toBe(false);
    });

    it("uses the fetched contents when GitHub responds with 200", async () => {
      mockHttpsGet(200, "remote-a\nremote-b\n");
      const getter = createGitHubStringSetGetter("some/path.txt", fallbackPath);
      const result = await getter();
      expect(result).toEqual(new Set(["remote-a", "remote-b", ""]));
    });
  });

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

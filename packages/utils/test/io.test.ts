import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock, Mock } from "node:test";
import { pipeline } from "node:stream/promises";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { EventEmitter } from "events";
import { list } from "tar";
import tarStream from "tar-stream";
import { createTgz, createGitHubStringSetGetter, stringOfStream, streamOfString } from "../io";

describe("io", () => {
  describe(stringOfStream.name, () => {
    it("reads Node.js streams", async () => {
      assert.equal(await stringOfStream(streamOfString("contents"), "test"), "contents");
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
      assert.equal(await result, "contents");
    });
  });

  describe(createGitHubStringSetGetter.name, () => {
    const originalNodeEnv = process.env.NODE_ENV;
    let fallbackPath: string;
    let getSpy: Mock<typeof https.get>;

    beforeEach(() => {
      // Force the network path (skipped when NODE_ENV === "test").
      process.env.NODE_ENV = "production";
      fallbackPath = path.join(os.tmpdir(), `gh-string-set-getter-${Date.now()}.txt`);
      fs.writeFileSync(fallbackPath, "local-a\nlocal-b\n");
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      getSpy?.mock.restore();
      if (fs.existsSync(fallbackPath)) {
        fs.unlinkSync(fallbackPath);
      }
    });

    function mockHttpsGet(statusCode: number, body: string): void {
      getSpy = mock.method(https, "get", ((_url: unknown, cb: (res: unknown) => void) => {
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
      assert.deepEqual(result, new Set(["local-a", "local-b", ""]));
      assert.equal(result.has("429: Too Many Requests"), false);
    });

    it("uses the fetched contents when GitHub responds with 200", async () => {
      mockHttpsGet(200, "remote-a\nremote-b\n");
      const getter = createGitHubStringSetGetter("some/path.txt", fallbackPath);
      const result = await getter();
      assert.deepEqual(result, new Set(["remote-a", "remote-b", ""]));
    });
  });

  describe(createTgz.name, () => {
    it("packs a directory", async () => {
      const dir = path.resolve("packages/utils/test/data/pack");
      const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "dt-pack-"));
      const archivePath = path.join(outputDir, "pack.tgz");
      try {
        await pipeline(
          createTgz(dir, (err) => {
            throw err;
          }),
          fs.createWriteStream(archivePath),
        );
        assert.equal(fs.existsSync(archivePath), true);
        const entries: string[] = [];
        await list({ file: archivePath, onentry: (e) => entries.push(e.path) });
        assert.deepEqual(entries, ["pack/", "pack/test.txt"]);
      } finally {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});

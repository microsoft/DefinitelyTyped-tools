import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock, Mock } from "node:test";
import type { NpmPublishClient } from "@definitelytyped/utils";
import { DTMock, TypingsData } from "@definitelytyped/definitions-parser";
import { License } from "@definitelytyped/header-parser";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { publishTypingsPackage } from "../src/lib/package-publisher";
import { ChangedTyping } from "../src/lib/versions";

const packageJson = { name: "@types/example", version: "2.0.0" };

function changedTyping(isLatest: boolean): ChangedTyping {
  return {
    pkg: new TypingsData(
      new DTMock().fs,
      {
        header: {
          name: "@types/example",
          owners: [],
          libraryMajorVersion: isLatest ? 2 : 1,
          libraryMinorVersion: 0,
          minimumTypeScriptVersion: "7.0",
          projects: [],
          nonNpm: false,
          tsconfigs: ["tsconfig.json"],
        },
        typesVersions: [],
        license: License.MIT,
        dependencies: {},
        devDependencies: { "@types/example": "workspace:." },
        olderVersionDirectories: [],
      },
      isLatest,
    ),
    version: isLatest ? "2.0.0" : "1.0.1",
    latestVersion: isLatest ? undefined : "2.0.0",
  };
}

describe("publishTypingsPackage", () => {
  let publish: Mock<NpmPublishClient["publish"]>;
  let untag: Mock<NpmPublishClient["untag"]>;
  let tag: Mock<NpmPublishClient["tag"]>;
  let log: Mock<(message: string) => void>;
  let client: Pick<NpmPublishClient, "publish" | "untag" | "tag">;
  let operations: string[];
  let packageDir: string;

  function writeManifest(version = packageJson.version) {
    const manifest = { ...packageJson, version };
    writeFileSync(join(packageDir, "package.json"), JSON.stringify(manifest));
    return manifest;
  }

  beforeEach(() => {
    operations = [];
    publish = mock.fn<NpmPublishClient["publish"]>(async () => {
      operations.push("publish");
    });
    untag = mock.fn<NpmPublishClient["untag"]>(async () => {
      operations.push("untag");
    });
    tag = mock.fn<NpmPublishClient["tag"]>(async (_name, _version, distTag) => {
      operations.push(distTag);
    });
    log = mock.fn<(message: string) => void>();
    client = { publish, untag, tag };
    packageDir = mkdtempSync(join(tmpdir(), "dt-package-publisher-"));
    writeManifest();
  });

  afterEach(() => {
    mock.reset();
    rmSync(packageDir, { recursive: true, force: true });
  });

  it("publishes the current version with the default tag", async () => {
    const typing = changedTyping(true);
    await publishTypingsPackage(client, typing, false, log, packageDir);

    assert.deepEqual(
      publish.mock.calls.map((call) => call.arguments),
      [[packageDir, packageJson, "latest", false, log]],
    );
    assert.equal(untag.mock.callCount(), 0);
    assert.deepEqual(
      tag.mock.calls.map((call) => call.arguments),
      [
        ["@types/example", "2.0.0", "ts7.0", false, log],
        ["@types/example", "2.0.0", "ts7.1", false, log],
        ["@types/example", "2.0.0", "latest", false, log],
      ],
    );
    assert.deepEqual(operations, ["publish", "ts7.0", "ts7.1", "latest"]);
  });

  it("publishes an old version without changing latest", async () => {
    const manifest = writeManifest("1.0.1");
    await publishTypingsPackage(client, changedTyping(false), false, log, packageDir);

    assert.deepEqual(
      publish.mock.calls.map((call) => call.arguments),
      [[packageDir, manifest, "old-version", false, log]],
    );
    assert.deepEqual(
      untag.mock.calls.map((call) => call.arguments),
      [["@types/example", "old-version", false, log]],
    );
    assert.deepEqual(operations, ["publish", "untag", "latest"]);
    assert.deepEqual(
      tag.mock.calls.map((call) => call.arguments),
      [["@types/example", "2.0.0", "latest", false, log]],
    );
  });

  it("continues if removing the temporary tag fails", async () => {
    untag.mock.mockImplementationOnce(async () => {
      throw new Error("registry unavailable");
    });
    writeManifest("1.0.1");

    assert.equal(await publishTypingsPackage(client, changedTyping(false), false, log, packageDir), undefined);
    assert.ok(
      log.mock.calls.some(
        (call) =>
          call.arguments[0] === "Failed to remove temporary tag for @types/example: Error: registry unavailable",
      ),
    );
    assert.deepEqual(
      tag.mock.calls.map((call) => call.arguments),
      [["@types/example", "2.0.0", "latest", false, log]],
    );
  });

  it("does not update tags when publishing fails", async () => {
    const error = new Error("publish failed");
    publish.mock.mockImplementationOnce(async () => {
      throw error;
    });
    await assert.rejects(
      publishTypingsPackage(client, changedTyping(false), false, log, packageDir),
      (reason) => reason === error,
    );
    assert.equal(untag.mock.callCount(), 0);
    assert.equal(tag.mock.callCount(), 0);
  });
});

import type { NpmPublishClient } from "@definitelytyped/utils";
import { DTMock, TypingsData } from "@definitelytyped/definitions-parser";
import { License } from "@definitelytyped/header-parser";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { publishTypingsPackage } from "../src/lib/package-publisher";
import { ChangedTyping } from "../src/lib/versions";

const packageJson = { name: "@types/example", version: "2.0.0" };
const log = jest.fn();

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
        olderVersionDirectories: [],
      },
      isLatest,
    ),
    version: isLatest ? "2.0.0" : "1.0.1",
    latestVersion: isLatest ? undefined : "2.0.0",
  };
}

describe("publishTypingsPackage", () => {
  const publish = jest.fn<ReturnType<NpmPublishClient["publish"]>, Parameters<NpmPublishClient["publish"]>>();
  const untag = jest.fn<ReturnType<NpmPublishClient["untag"]>, Parameters<NpmPublishClient["untag"]>>();
  const tag = jest.fn<ReturnType<NpmPublishClient["tag"]>, Parameters<NpmPublishClient["tag"]>>();
  const client = { publish, untag, tag };
  let packageDir: string;

  function writeManifest(version = packageJson.version) {
    const manifest = { ...packageJson, version };
    writeFileSync(join(packageDir, "package.json"), JSON.stringify(manifest));
    return manifest;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    publish.mockReset().mockResolvedValue(undefined);
    untag.mockReset().mockResolvedValue(undefined);
    tag.mockReset().mockResolvedValue(undefined);
    packageDir = mkdtempSync(join(tmpdir(), "dt-package-publisher-"));
    writeManifest();
  });

  afterEach(() => {
    rmSync(packageDir, { recursive: true, force: true });
  });

  it("publishes the current version with the default tag", async () => {
    const typing = changedTyping(true);
    await publishTypingsPackage(client, typing, false, log, packageDir);

    expect(publish).toHaveBeenCalledWith(packageDir, packageJson, "latest", false, log);
    expect(untag).not.toHaveBeenCalled();
    expect(tag.mock.calls).toEqual([
      ["@types/example", "2.0.0", "ts7.0", false, log],
      ["@types/example", "2.0.0", "ts7.1", false, log],
      ["@types/example", "2.0.0", "latest", false, log],
    ]);
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(tag.mock.invocationCallOrder[0]);
  });

  it("publishes an old version without changing latest", async () => {
    const manifest = writeManifest("1.0.1");
    await publishTypingsPackage(client, changedTyping(false), false, log, packageDir);

    expect(publish).toHaveBeenCalledWith(packageDir, manifest, "old-version", false, log);
    expect(untag).toHaveBeenCalledWith("@types/example", "old-version", false, log);
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(untag.mock.invocationCallOrder[0]);
    expect(untag.mock.invocationCallOrder[0]).toBeLessThan(tag.mock.invocationCallOrder[0]);
    expect(tag.mock.calls).toEqual([["@types/example", "2.0.0", "latest", false, log]]);
  });

  it("continues if removing the temporary tag fails", async () => {
    untag.mockRejectedValueOnce(new Error("registry unavailable"));
    writeManifest("1.0.1");

    await expect(publishTypingsPackage(client, changedTyping(false), false, log, packageDir)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Failed to remove temporary tag for @types/example: Error: registry unavailable");
    expect(tag.mock.calls).toEqual([["@types/example", "2.0.0", "latest", false, log]]);
  });

  it("does not update tags when publishing fails", async () => {
    const error = new Error("publish failed");
    publish.mockRejectedValueOnce(error);
    await expect(publishTypingsPackage(client, changedTyping(false), false, log, packageDir)).rejects.toBe(error);
    expect(untag).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
  });
});

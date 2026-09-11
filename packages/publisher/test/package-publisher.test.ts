import { NpmPublishClient, readFileAndWarn } from "@definitelytyped/utils";
import { updateLatestTag } from "@definitelytyped/retag";
import { publishTypingsPackage } from "../src/lib/package-publisher";
import { ChangedTyping } from "../src/lib/versions";

jest.mock("@definitelytyped/utils", () => ({
  ...jest.requireActual("@definitelytyped/utils"),
  readFileAndWarn: jest.fn(),
}));
jest.mock("@definitelytyped/retag", () => ({
  updateLatestTag: jest.fn(),
  updateTypeScriptVersionTags: jest.fn(),
}));

const packageJson = { name: "@types/example", version: "2.0.0" };
const log = jest.fn();

function changedTyping(isLatest: boolean): ChangedTyping {
  return {
    pkg: {
      isLatest,
      name: "@types/example",
      typesDirectoryName: "example",
      major: isLatest ? 2 : 1,
      minor: 0,
    },
    version: isLatest ? "2.0.0" : "1.0.1",
    latestVersion: isLatest ? undefined : "2.0.0",
  } as ChangedTyping;
}

describe("publishTypingsPackage", () => {
  const publish = jest.fn();
  const untag = jest.fn();
  const client = { publish, untag } as unknown as NpmPublishClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readFileAndWarn).mockResolvedValue(packageJson);
    publish.mockReset();
    untag.mockReset();
  });

  it("publishes the current version with the default tag", async () => {
    await publishTypingsPackage(client, changedTyping(true), false, log);

    expect(publish).toHaveBeenCalledWith(expect.any(String), packageJson, "latest", false, log);
    expect(untag).not.toHaveBeenCalled();
  });

  it("publishes an old version without changing latest", async () => {
    await publishTypingsPackage(client, changedTyping(false), false, log);

    expect(publish).toHaveBeenCalledWith(expect.any(String), packageJson, "old-version", false, log);
    expect(untag).toHaveBeenCalledWith("@types/example", "old-version", false, log);
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(untag.mock.invocationCallOrder[0]);
    expect(updateLatestTag).toHaveBeenCalledWith("@types/example", "2.0.0", client, log, false);
  });

  it("continues if removing the temporary tag fails", async () => {
    untag.mockRejectedValueOnce(new Error("registry unavailable"));

    await expect(publishTypingsPackage(client, changedTyping(false), false, log)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "Failed to remove temporary tag for @types/example: Error: registry unavailable",
    );
    expect(updateLatestTag).toHaveBeenCalledWith("@types/example", "2.0.0", client, log, false);
  });
});

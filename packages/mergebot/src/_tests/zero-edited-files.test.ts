import { join } from "path";
import { process } from "../compute-pr-actions";
import { deriveStateForPR, PRQueryResponse } from "../pr-info";
import { readJsonSync } from "../util/util";

describe("zero edited files", () => {
  it("closes open PRs immediately", async () => {
    const responsePath = join(__dirname, "fixtures", "43136", "_response.json");
    const response: PRQueryResponse = readJsonSync(responsePath);
    const original = response.data.repository?.pullRequest;
    if (!original) throw new Error("Missing pull request in fixture");

    const prInfo = {
      ...original,
      changedFiles: 0,
      files: { ...original.files, nodes: [] },
    };

    const derived = await deriveStateForPR(
      prInfo,
      async () => {
        throw new Error("fetchFile should not be called");
      },
      async () => {
        throw new Error("getDownloads should not be called");
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(derived).toMatchObject({
      type: "remove",
      message: "PR has no edited files",
      isDraft: false,
      shouldClose: true,
    });

    const actions = process(derived);
    expect(actions).toMatchObject({
      projectColumn: "*REMOVE*",
      shouldClose: true,
      shouldUpdateLabels: false,
    });
    expect(actions.responseComments).toEqual([]);
  });
});

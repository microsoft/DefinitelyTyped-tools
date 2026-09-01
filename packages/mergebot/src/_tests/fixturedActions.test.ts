import { readdirSync } from "fs";
import { join } from "path";
import { toMatchFile } from "jest-file-snapshot";
import { process } from "../compute-pr-actions";
import { deriveStateForPR, PRQueryResponse } from "../pr-info";
import { readJsonSync, scrubDiagnosticDetails } from "../util/util";
import * as cachedQueries from "./cachedQueries";
jest.mock("../util/cachedQueries", () =>
  Object.fromEntries(Object.entries(cachedQueries).map(([k, v]) => [k, jest.fn(() => Promise.resolve(v))])),
);
import { executePrActions } from "../execute-pr-actions";

expect.extend({ toMatchFile });

/* You can use the following command to add/update fixtures with an existing PR
 *
 *     BOT_AUTH_TOKEN=XYZ pnpm run create-fixture 43164
 */

async function testFixture(dir: string) {
  // _foo.json are input files, except for Date.now from derived.json
  const responsePath = join(dir, "_response.json");
  const filesPath = join(dir, "_files.json");
  const downloadsPath = join(dir, "_downloads.json");
  const derivedPath = join(dir, "derived.json");
  const resultPath = join(dir, "result.json");
  const mutationsPath = join(dir, "mutations.json");

  const jsonString = (value: unknown) => scrubDiagnosticDetails(JSON.stringify(value, null, "  ") + "\n");

  const response: PRQueryResponse = readJsonSync(responsePath);
  const files = readJsonSync(filesPath);
  const downloads = readJsonSync(downloadsPath);

  const prInfo = response.data.repository?.pullRequest;
  if (!prInfo) throw new Error("Should never happen");

  // Fixtures recorded before potentialMergeCommit was queried use the head tree.
  const prInfoWithMergeCommit =
    prInfo.potentialMergeCommit === undefined && prInfo.mergeable !== "CONFLICTING"
      ? {
          ...prInfo,
          potentialMergeCommit: {
            __typename: "Commit" as const,
            oid: prInfo.headRefOid,
            parents: {
              __typename: "CommitConnection" as const,
              totalCount: 2,
              nodes: [
                { __typename: "Commit" as const, oid: prInfo.baseRefOid },
                { __typename: "Commit" as const, oid: prInfo.headRefOid },
              ],
            },
          },
        }
      : prInfo;

  const derived = await deriveStateForPR(
    prInfoWithMergeCommit,
    (expr: string) => Promise.resolve(files[expr] as string),
    (name: string, _until?: Date) => (name in downloads ? downloads[name] : 0),
    new Date(readJsonSync(derivedPath).now),
  );

  const action = process(derived);

  expect(jsonString(action)).toMatchFile(resultPath);
  expect(jsonString(derived)).toMatchFile(derivedPath);
  const mutations = await executePrActions(action, prInfo, /*dry*/ true);
  expect(jsonString(mutations)).toMatchFile(mutationsPath);
}

describe("Test fixtures", () => {
  const fixturesFolder = join(__dirname, "fixtures");
  readdirSync(fixturesFolder, { withFileTypes: true }).forEach((dirent) => {
    if (dirent.isDirectory()) {
      it(`Fixture: ${dirent.name}`, async () => testFixture(join(fixturesFolder, dirent.name)));
    }
  });
});

describe("Potential merge commit validation", () => {
  const response: PRQueryResponse = readJsonSync(join(__dirname, "fixtures", "75475", "_response.json"));
  const prInfo = response.data.repository?.pullRequest;
  const potentialMergeCommit = prInfo?.potentialMergeCommit;
  if (!prInfo || !potentialMergeCommit) throw new Error("Fixture must have a potential merge commit");

  it("fails closed when the potential merge commit is unavailable", async () => {
    const derived = await deriveStateForPR({ ...prInfo, potentialMergeCommit: null });

    expect(derived).toMatchObject({
      type: "error",
      message: "No potential merge commit found",
    });
  });

  it("fails closed when the potential merge commit has unexpected parents", async () => {
    const derived = await deriveStateForPR({
      ...prInfo,
      potentialMergeCommit: {
        ...potentialMergeCommit,
        parents: {
          ...potentialMergeCommit.parents,
          nodes: [
            { __typename: "Commit", oid: prInfo.baseRefOid },
            { __typename: "Commit", oid: "attacker-controlled-oid" },
          ],
        },
      },
    });

    expect(derived).toMatchObject({
      type: "error",
      message: "Potential merge commit does not match the pull request base and head",
    });
  });
});

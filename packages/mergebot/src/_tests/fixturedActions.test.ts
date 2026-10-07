import assert from "node:assert/strict";
import { describe, it, test, TestContext } from "node:test";
import { readdirSync } from "fs";
import { join, resolve } from "path";
import { Actions, process } from "../compute-pr-actions";
import { projectBoardNumber } from "../basic";
import { deriveStateForPR, PRQueryResponse } from "../pr-info";
import { readJsonSync, scrubDiagnosticDetails } from "../util/util";
import * as cachedQueries from "../../src/_tests/cachedQueries";
import { executePrActions } from "../execute-pr-actions";

const queries = {
  getLabels: async () => cachedQueries.getLabels,
  getProjectBoardColumns: async () => cachedQueries.getProjectBoardColumns,
};

/* You can use the following command to add/update fixtures with an existing PR
 *
 *     BOT_AUTH_TOKEN=XYZ pnpm run create-fixture 43164
 */

async function testFixture(dir: string, t: TestContext) {
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

  const derived = await deriveStateForPR(
    prInfo,
    (expr: string) => Promise.resolve(files[expr] as string),
    (name: string, _until?: Date) => (name in downloads ? downloads[name] : 0),
    new Date(readJsonSync(derivedPath).now),
  );

  const action = process(derived);

  t.assert.fileSnapshot(jsonString(action), resultPath, { serializers: [String] });
  t.assert.fileSnapshot(jsonString(derived), derivedPath, { serializers: [String] });
  const mutations = await executePrActions(action, prInfo, /*dry*/ true, /*projectOnly*/ false, queries);
  t.assert.fileSnapshot(jsonString(mutations), mutationsPath, { serializers: [String] });
}

describe("Test fixtures", () => {
  const fixturesFolder = resolve("packages/mergebot/src/_tests/fixtures");
  readdirSync(fixturesFolder, { withFileTypes: true }).forEach((dirent) => {
    if (dirent.isDirectory()) {
      it(`Fixture: ${dirent.name}`, async (t) => testFixture(join(fixturesFolder, dirent.name), t));
    }
  });
});

for (const row of [
  "no actions",
  "unchanged labels",
  "remove project card",
  "remove missing project card",
  "remove recently merged project card",
  "unchanged project column",
  "project-only",
  "project-only column change",
] as const) {
  test(`only queries required data for ${row}`, async () => {
    const scenario = row;
    const response: PRQueryResponse = readJsonSync(
      resolve("packages/mergebot/src/_tests/fixtures/43160/_response.json"),
    );
    const prInfo = response.data.repository?.pullRequest;
    if (!prInfo) throw new Error("Missing fixture pull request");
    const pr: Parameters<typeof executePrActions>[1] = {
      ...prInfo,
      labels: { __typename: "LabelConnection", nodes: [] },
      projectItems: {
        __typename: "ProjectV2ItemConnection",
        nodes: [
          {
            __typename: "ProjectV2Item",
            id: "card",
            updatedAt: "2020-01-01T00:00:00Z",
            project: { __typename: "ProjectV2", id: "project", number: projectBoardNumber },
            fieldValueByName: {
              __typename: "ProjectV2ItemFieldSingleSelectValue",
              name: scenario === "remove recently merged project card" ? "Recently Merged" : "Other",
              field: { __typename: "ProjectV2SingleSelectField", id: "field" },
            },
          },
        ],
      },
    };
    const actions: Actions = {
      labels: [],
      responseComments: [],
      shouldClose: false,
      shouldMerge: false,
      shouldUpdateLabels: scenario === "unchanged labels" || scenario.startsWith("project-only"),
    };
    if (scenario.startsWith("remove")) actions.projectColumn = "*REMOVE*";
    if (scenario === "remove missing project card") pr.projectItems.nodes = [];
    if (scenario === "unchanged project column") actions.projectColumn = "Other";
    if (scenario.startsWith("project-only")) actions.labels = ["Unmerged"];
    if (scenario === "project-only column change") actions.projectColumn = "Needs Maintainer Review";
    let columnQueries = 0;
    const mutations = await executePrActions(actions, pr, true, scenario.startsWith("project-only"), {
      getLabels: async () => {
        throw new Error("Unexpected labels query");
      },
      getProjectBoardColumns: async () => {
        columnQueries++;
        if (scenario === "project-only column change") return cachedQueries.getProjectBoardColumns;
        throw new Error("Unexpected project columns query");
      },
    });
    assert.equal(
      mutations.length,
      scenario === "remove project card" || scenario === "project-only column change" ? 1 : 0,
    );
    assert.equal(columnQueries, scenario === "project-only column change" ? 1 : 0);
  });
}

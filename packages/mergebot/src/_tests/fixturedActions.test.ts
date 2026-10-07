import { readdirSync } from "fs";
import { join } from "path";
import { toMatchFile } from "jest-file-snapshot";
import { Actions, process } from "../compute-pr-actions";
import { projectBoardNumber } from "../basic";
import { deriveStateForPR, PRQueryResponse } from "../pr-info";
import { readJsonSync, scrubDiagnosticDetails } from "../util/util";
import * as cachedQueries from "./cachedQueries";
import { executePrActions } from "../execute-pr-actions";

const queries = {
  getLabels: async () => cachedQueries.getLabels,
  getProjectBoardColumns: async () => cachedQueries.getProjectBoardColumns,
};

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

  const derived = await deriveStateForPR(
    prInfo,
    (expr: string) => Promise.resolve(files[expr] as string),
    (name: string, _until?: Date) => (name in downloads ? downloads[name] : 0),
    new Date(readJsonSync(derivedPath).now),
  );

  const action = process(derived);

  expect(jsonString(action)).toMatchFile(resultPath);
  expect(jsonString(derived)).toMatchFile(derivedPath);
  const mutations = await executePrActions(action, prInfo, /*dry*/ true, /*projectOnly*/ false, queries);
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

test.each([
  "no actions",
  "unchanged labels",
  "remove project card",
  "remove missing project card",
  "remove recently merged project card",
  "unchanged project column",
  "project-only",
  "project-only column change",
])("only queries required data for %s", async (scenario) => {
  const response: PRQueryResponse = readJsonSync(join(__dirname, "fixtures", "43160", "_response.json"));
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
  expect(mutations).toHaveLength(
    scenario === "remove project card" || scenario === "project-only column change" ? 1 : 0,
  );
  expect(columnQueries).toBe(scenario === "project-only column change" ? 1 : 0);
});

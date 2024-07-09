import { ApolloQueryResult } from "@apollo/client/core";
import { readdirSync } from "fs";
import { join } from "path";
import { toMatchFile } from "jest-file-snapshot";
import { process } from "../compute-pr-actions";
import { deriveStateForPR } from "../pr-info";
import { PR } from "../queries/schema/PR";
import { readJsonSync, scrubDiagnosticDetails } from "../util/util";
import * as cachedQueries from "./cachedQueries.json";
jest.mock("../util/cachedQueries", () => ({
  getProjectBoardColumns: jest.fn(() => new Map(cachedQueries.getProjectBoardColumns.map(o => [o.name,o.optionId]))),
  getLabels: jest.fn(() => cachedQueries.getLabels),
}));
import { executePrActions } from "../execute-pr-actions";

expect.extend({ toMatchFile });

/* You can use the following command to add/update fixtures with an existing PR
 *
 *     BOT_AUTH_TOKEN=XYZ pnpm run create-fixture -- 43164
 */

async function testFixture(dir: string) {
  // _foo.json are input files, except for Date.now from derived.json
  const responsePath = join(dir, "_response.json");
  const filesPath = join(dir, "_files.json");
  const downloadsPath = join(dir, "_downloads.json");
  const derivedPath = join(dir, "derived.json");
  const resultPath = join(dir, "result.json");
  const mutationsPath = join(dir, "mutations.json");

  const jsonString = (value: any) => scrubDiagnosticDetails(JSON.stringify(value, null, "  ") + "\n");

  const response: ApolloQueryResult<PR> = readJsonSync(responsePath);
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

// @ts-check
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Converts old project board cards to new project board cards, left
// around so that someone who needs to edit fixtures can start from
// an existing framework

//  node src/scripts/updateJSONFixtures.mjs
//  (requires node >20.11 for import.meta.dirname support)

// https://github.com/orgs/DefinitelyTyped/projects/1
const projectBoardNumber = 1;
const projectIdStatic = "PVT_kwDOADeBNM4AkH1q";
/** The id for the Status field */
const fieldIdStatic = "PVTSSF_lADOADeBNM4AkH1qzgcYOEM";
const fixtureRoot = join(import.meta.dirname, "..", "_tests", "fixtures");
const fixtureNames = readdirSync(fixtureRoot);

for (const fixture of fixtureNames) {
  const responsePath = join(fixtureRoot, fixture, "_response.json");
  const response = JSON.parse(readFileSync(responsePath, "utf8"));
  const pr = response.data.repository.pullRequest;
  const cards = pr.projectCards;
  const items = [];
  for (const node of cards.nodes) {
    items.push({
      id: node.id,
      project: {
        id: projectIdStatic,
        number: projectBoardNumber,
        __typename: "ProjectV2",
      },
      fieldValueByName: {
        __typename: "ProjectV2ItemFieldSingleSelectValue",
        name: node.column.name,
        field: {
          __typename: "ProjectV2SingleSelectField",
          id: fieldIdStatic,
        },
      },
    });
  }

  pr.projectItems = { nodes: items, __typename: "ProjectV2ItemConnection" };
  console.log(JSON.stringify(pr.projectItems))
  delete pr.projectCards;
  response.data.repository.pullRequest = pr;

  writeFileSync(responsePath, JSON.stringify(response, null, "  ") + "\n", "utf8");
}

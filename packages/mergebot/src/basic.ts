export type ColumnName =
  | "Needs Maintainer Action"
  | "Needs Maintainer Review"
  | "Other"
  | "Waiting for Author to Merge"
  | "Needs Author Action"
  | "Recently Merged"
  | "Waiting for Code Reviews"
  | BlessedColumnName
  | "*REMOVE*"; // special value: indicates closing the PR

export type BlessedColumnName = (typeof blessedColumnNames)[number];

const blessedColumnNames = [
  "Waiting for Code Reviews (Blessed)",
  "Waiting for Author to Merge (Blessed)",
] as const;

export function isBlessedColumnName(column: string): column is BlessedColumnName {
  return blessedColumnNames.includes(column as BlessedColumnName);
}

export const columnNameToBlessed: { [K in ColumnName]?: BlessedColumnName } = {
  "Waiting for Code Reviews": "Waiting for Code Reviews (Blessed)",
  "Waiting for Author to Merge": "Waiting for Author to Merge (Blessed)",
};

export type PopularityLevel = "Well-liked by everyone" | "Popular" | "Critical";

export type StalenessKind = (typeof stalenessKinds)[number];
const stalenessKinds = [
  // all are also label names
  "Unmerged",
  "Abandoned",
  "Unreviewed",
] as const;

export type LabelName = (typeof labelNames)[number];
export const labelNames = [
  "Mergebot Error",
  "Has Merge Conflict",
  "The CI failed",
  "The CI is blocked",
  "Revision needed",
  "New Definition",
  "Edits Owners",
  "Where is GH Actions?",
  "Owner Approved",
  "Other Approved",
  "Maintainer Approved",
  "Self Merge",
  "Popular package",
  "Critical package",
  "Edits Infrastructure",
  "Possibly Edits Infrastructure",
  "Edits multiple packages",
  "Author is Owner",
  "No Other Owners",
  "Too Many Owners",
  "Untested Change",
  "Check Config",
  "Too Many Files",
  "Huge Change",
  "Needs Actions Permission",
  ...stalenessKinds,
] as const;

export type ApproverKind = (typeof approverKindOrder)[number];

const approverKindOrder = ["other", "owner", "maintainer"] as const;

export function getMaxApproverKind(...kinds: ApproverKind[]): ApproverKind {
  return approverKindOrder[kinds.reduce((max, kind) => Math.max(max, approverKindOrder.indexOf(kind)), 0)]!;
}

// https://github.com/orgs/DefinitelyTyped/projects/1
export const projectBoardNumber = 1;

/**
 * The id for the project board, saved statically for inserting new cards.
 * you can query this with `projectV2(number: 1) { id }`
 */
export const projectIdStatic = "PVT_kwDOADeBNM4AkH1q";

/**
 * The id for the Status field, which controls the column that the card appears in.
 * This is the statically saved ID, used as a fallback if the field id isn't found dynamically.
 */
export const fieldIdStatic = "PVTSSF_lADOADeBNM4AkH1qzgcYOEM";

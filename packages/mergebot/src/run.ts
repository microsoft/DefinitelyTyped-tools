#!/usr/bin/env node

import * as schema from "@octokit/graphql-schema/schema";
import yargs from "yargs";
import { process as computeActions } from "./compute-pr-actions";
import { getAllOpenPRsAndCardIDs } from "./queries/all-open-prs-query";
import { getPRInfo } from "./queries/pr-query";
import { deriveStateForPR, BotResult } from "./pr-info";
import { executePrActions } from "./execute-pr-actions";
import { getProjectBoardCards } from "./queries/projectboard-cards";
import { runQueryToGetPRForCardId } from "./queries/card-id-to-pr-query";
import { createMutation, client } from "./graphql-client";
import { render } from "prettyjson";
import { inspect } from "util";

const args = yargs(process.argv.slice(2))
  .usage("Usage: $0 [options] pr...")
  .usage("  Run over specified PRs, or all if no PRs specified")
  .usage("  Each pr is either a number or a N-M number range")
  .options({
    dry: { alias: ["d"], type: "boolean", default: false, desc: "don't execute actions" },
    cleanup: { alias: ["c"], type: "boolean", default: true, desc: "cleanup columns when done" },
    format: { alias: ["f"], choices: ["json", "yaml", "node"], desc: "format for information display" },
    "show-raw": { alias: ["s1"], type: "boolean", desc: "display raw query result" },
    "show-basic": { alias: ["s2"], type: "boolean", desc: "display basic pr info" },
    "show-extended": { alias: ["s3"], type: "boolean", desc: "display extended info" },
    "show-actions": { alias: ["s4"], type: "boolean", desc: "display actions" },
    "show-mutations": { alias: ["s5"], type: "boolean", desc: "display mutations" },
    "project-only": { type: "boolean", desc: "Only change the project board, nothing else." },
  })
  .coerce("_", (prs: (number | string)[]) =>
    prs.map((pr) => {
      if (typeof pr === "number") return (n: number) => n === pr;
      if (pr.match(/^\d+$/)) return (n: number) => n === +pr;
      const m = pr.match(/^(\d+)-(\d+)$/);
      if (!m) throw new Error(`bad PR or PR range argument: "${pr}"`);
      const lo = +m[1]!,
        hi = +m[2]!;
      return (n: number) => lo <= n && n <= hi;
    }),
  )
  .help("h")
  .alias("h", "help")
  .strict().argv as {
  // Ignore the possibility that argv could be a promise
  [x: string]: unknown;
  dry: boolean;
  cleanup: boolean;
  format: string | undefined;
  "show-raw": boolean | undefined;
  showRaw: boolean | undefined;
  "show-basic": boolean | undefined;
  showBasic: boolean | undefined;
  "show-extended": boolean | undefined;
  showExtended: boolean | undefined;
  "show-actions": boolean | undefined;
  showActions: boolean | undefined;
  "show-mutations": boolean | undefined;
  showMutations: boolean | undefined;
  "project-only": boolean | undefined;
  _: ((n: number) => boolean)[] & (string | number)[];
};
const shouldRunOn: (n: number) => boolean = args._.length === 0 ? (_n) => true : (n) => args._.some((p) => p(n));

const xform = (x: unknown, xlate: (s: string) => string): unknown => {
  if (typeof x === "string") return xlate(x);
  if (typeof x !== "object" || x === null) return x;
  if (Array.isArray(x)) return x.map((e) => xform(e, xlate));
  const o = x as { [k: string]: unknown };
  return Object.fromEntries(Object.keys(o).map((k) => [k, xform(o[k], xlate)]));
};

const show = (name: string, value: unknown) => {
  console.log(`  === ${name} ===`);
  value = xform(value, (s: string) =>
    s.replace(/\n---+\s*<details><summary>(Diagnostic Information)[^]*?<\/details>/g, "...$1..."),
  );
  let str =
    args.format === "json"
      ? JSON.stringify(value, undefined, 2)
      : args.format === "yaml"
        ? render(value)
        : inspect(value, { depth: null, colors: true });
  str = str.replace(/^/gm, "  ");
  console.log(str);
};

const start = async function () {
  console.log(`Getting open PRs.`);
  const { prs, cardIDs } = await getAllOpenPRsAndCardIDs();
  //
  const failures = [];
  for (const pr of prs) {
    if (!shouldRunOn(pr)) continue;
    console.log(`Processing #${pr} (${prs.indexOf(pr) + 1} of ${prs.length})...`);
    // Generate the info for the PR from scratch
    const info = await getPRInfo(pr);
    if (args["show-raw"]) show("Raw Query Result", info);
    const prInfo = info.data.repository?.pullRequest;
    // If it didn't work, bail early
    if (!prInfo) {
      console.error(`  No PR with this number exists, (${JSON.stringify(info)})`);
      continue;
    }
    let state: BotResult | undefined;
    try {
      state = await deriveStateForPR(prInfo);
    } catch (e) {
      console.error(`  Error: ${e}`);
      failures.push([e, pr]);
      continue;
    }
    if (args["show-basic"]) show("Basic PR Info", state);
    // Show errors in log but keep processing to show in a comment too
    if (state.type === "error") console.error(`  Error: ${state.message}`);
    // Show other messages too
    if ("message" in state) console.log(`  ... ${state.message}`);
    // Convert the info to a set of actions for the bot
    const actions = computeActions(state, args["show-extended"] ? (i) => show("Extended Info", i) : undefined);
    if (args["show-actions"]) show("Actions", actions);
    // Act on the actions
    const mutations = await executePrActions(actions, prInfo, args.dry, args["project-only"]);
    if (args["show-mutations"] ?? args.dry) show("Mutations", mutations);
  }
  if (args.dry || !args.cleanup) return;
  //
  console.log("Cleaning up cards");
  const { columns, id: projectId } = await getProjectBoardCards();
  const deleteObject = async (id: string) => {
    console.log(`  Deleting card ${id}`);
    const mutation = createMutation<schema.DeleteProjectV2ItemInput>("deleteProjectV2Item", { projectId, itemId: id });
    await client.mutate(mutation);
  };
  // Reduce "Recently Merged"
  {
    const recentlyMerged = columns.get("Recently Merged");
    if (!recentlyMerged) {
      throw new Error(`Could not find the 'Recently Merged' column in ${Array.from(columns.keys())}`);
    }
    const afterFirst50 = recentlyMerged.sort((l, r) => l.updatedAt.localeCompare(r.updatedAt)).slice(50);
    if (afterFirst50.length > 0) {
      console.log(`Cutting "Recently Merged" projects to the last 50`);
      for (const card of afterFirst50) await deleteObject(card.id);
    }
  }
  // Handle other columns
  for (const [name, cards] of columns) {
    if (name === "Recently Merged") continue;
    const ids = cards.map((c) => c.id).filter((id) => !cardIDs.includes(id));
    if (ids.length === 0) continue;
    console.log(`Cleaning up closed PRs in "${name}"`);
    for (const id of ids) {
      const info = await runQueryToGetPRForCardId(id);
      if (!info) {
        // don't automatically delete these, eg, PRs that were created
        // during the scan would end up here.
        console.log(`  Should delete "${id}" (PR #???)`);
      } else if (info.state !== "OPEN") {
        await deleteObject(id);
      }
    }
  }
  if (failures.length) {
    console.error(`\n\nThe following PRs failed:`);
    for (const [e, pr] of failures) {
      console.error(`  #${pr}: ${e}`);
    }
    throw failures[0]![0];
  } else {
    console.log("Done");
  }
};

start().catch(function (error) {
  process.exitCode = 1;
  console.error(error);
});

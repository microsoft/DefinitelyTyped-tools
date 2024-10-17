import { ESLint, Linter } from "eslint";
import path from "path";
import stripAnsi from "strip-ansi";
import { globSync } from "glob";
import { fixtureRoot } from "./util";
import { toMatchFile } from "jest-file-snapshot";
import * as plugin from "../src/index";
import fs from "fs";
import { normalizeSlashes } from "@definitelytyped/utils";

expect.extend({ toMatchFile });
const snapshotDir = path.join(__dirname, "__file_snapshots__");

const allFixtures = globSync(["**/*.ts", "**/*.cts", "**/*.mts", "**/*.tsx"], { cwd: fixtureRoot });

function getLintSnapshotPath(fixture: string): string {
  return path.join(snapshotDir, `${fixture}.lint`);
}

function getAllLintSnapshots() {
  return new Set(globSync("**/*.lint", { cwd: snapshotDir, absolute: true }));
}

function getAllExpectedLintSnapshots() {
  return new Set(allFixtures.map(getLintSnapshotPath));
}

// Force one test per fixture so we can see when a file has no errors.
for (const fixture of allFixtures) {
  describe(`fixture ${fixture}`, () => {
    it("should lint", async () => {
      const eslint = new ESLint({
        cwd: fixtureRoot,
        plugins: { [plugin.meta.name]: plugin },
      });

      const results = await eslint.lintFiles([fixture]);
      for (const result of results) {
        result.filePath = path.relative(fixtureRoot, result.filePath);
      }
      const formatter = await eslint.loadFormatter("stylish");
      const formatted = await formatter.format(results);
      const resultText = stripAnsi(formatted).trim() || "No errors";
      expect(resultText).not.toContain("Parsing error");
      const newOutput = formatResultsWithInlineErrors(results);
      expect(normalizeSnapshot(resultText + "\n\n" + newOutput)).toMatchFile(getLintSnapshotPath(fixture));
    });
  });
}

function normalizeSnapshot(snapshot: string): string {
  return snapshot
    .split(/\r?\n/g)
    .map((line) => {
      if (line.startsWith("types\\")) {
        return normalizeSlashes(line);
      }
      return line;
    })
    .join("\n");
}

function formatResultsWithInlineErrors(results: ESLint.LintResult[]): string {
  const output: string[] = [];

  function pushMessage(message: Linter.LintMessage): void {
    const ruleId = message.ruleId;
    if (!ruleId) {
      throw new Error("Expected ruleId");
    }
    const lines = message.message.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prefix = `!!! ${i === 0 ? ruleId : " ".repeat(ruleId.length)}: `;
      output.push(prefix + line);
    }
  }

  const indent = "    ";

  for (const result of results) {
    output.push(`==== ${normalizeSlashes(result.filePath)} ====`);
    output.push("");

    const sourceText = fs.readFileSync(path.join(fixtureRoot, result.filePath), "utf-8");

    const lines = sourceText.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      output.push(indent + line);

      for (const message of result.messages) {
        const startLine = message.line - 1;
        const endLine = message.endLine === undefined ? startLine : message.endLine - 1;
        const startColumn = message.column - 1;
        const endColumn = message.endColumn === undefined ? startColumn : message.endColumn - 1;
        if (i < startLine || i > endLine) {
          continue;
        }
        if (i === startLine) {
          const squiggle = "~".repeat(Math.max(1, endColumn - startColumn));
          output.push(indent + " ".repeat(startColumn) + squiggle);
          pushMessage(message);
        } else {
          const squiggle = "~".repeat(Math.max(1, line.length - startColumn));
          output.push(indent + squiggle);
        }
      }
    }

    output.push("");
  }

  return output.join("\n").trim() + "\n";
}

// Similar to https://github.com/storybookjs/storybook/blob/df357020e010f49e7c325942f0c891e6702527d6/code/addons/storyshots-core/src/api/integrityTestTemplate.ts
describe("lint snapshots", () => {
  it("abandoned snapshots", () => {
    const expectedSnapshots = getAllExpectedLintSnapshots();
    const actualSnapshots = getAllLintSnapshots();
    const abandonedSnapshots = [...actualSnapshots].filter((s) => !expectedSnapshots.has(s));

    if (abandonedSnapshots.length === 0) {
      return;
    }

    // https://github.com/jestjs/jest/issues/8732#issuecomment-516445064
    if (expect.getState().snapshotState._updateSnapshot === "all") {
      for (const abandoned of abandonedSnapshots) {
        fs.rmSync(abandoned);
      }
      return;
    }

    expect(abandonedSnapshots).toHaveLength(0);
  });
});

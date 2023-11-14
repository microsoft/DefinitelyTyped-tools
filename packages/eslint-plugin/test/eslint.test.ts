import { ESLint, Linter } from "eslint";
import path from "path";
import stripAnsi from "strip-ansi";
import { globSync } from "glob";
import { fixtureRoot } from "./util";
import { toMatchFile } from "jest-file-snapshot";
import fs from "fs";

expect.extend({ toMatchFile });
const snapshotDir = path.join(__dirname, "__file_snapshots__");

const allFixtures = globSync(["**/*.ts", "**/*.cts", "**/*.mts", "**/*.tsx"], { cwd: fixtureRoot });

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: fixtureRoot });
});

afterAll(() => {
  eslint = undefined as any;
});

// Force one test per fixture so we can see when a file has no errors.
for (const fixture of allFixtures) {
  describe(`fixture ${fixture}`, () => {
    it("should lint", async () => {
      const results = await eslint.lintFiles([fixture]);
      for (const result of results) {
        result.filePath = path.relative(fixtureRoot, result.filePath);
      }
      const formatter = await eslint.loadFormatter("stylish");
      const formatted = await formatter.format(results);
      const resultText = stripAnsi(formatted).trim() || "No errors";
      expect(resultText).not.toContain("Parsing error");
      const newOutput = formatResultsWithInlineErrors(results);
      expect(resultText + "\n\n" + newOutput).toMatchFile(path.join(snapshotDir, `${fixture}.lint`));
    });
  });
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
    output.push(`==== ${result.filePath} ====`);
    output.push("");

    const sourceText = fs.readFileSync(path.join(fixtureRoot, result.filePath), "utf-8");

    const messagesWithPositions: Linter.LintMessage[] = [];

    for (const message of result.messages) {
      if (message.line !== undefined) {
        messagesWithPositions.push(message);
        continue;
      }
      pushMessage(message);
    }

    const lines = sourceText.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      output.push(indent + line);

      for (const message of messagesWithPositions) {
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

  return output.join("\n");
}

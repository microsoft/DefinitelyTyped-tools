import { ESLint } from "eslint";
import path from "path";
import stripAnsi from "strip-ansi";
import { globSync } from "glob";
import { fixtureRoot } from "./util";

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
      const resultText = stripAnsi(formatted);
      expect(resultText).not.toContain("Parsing error");
      expect(resultText).toMatchSnapshot("results");
    });
  });
}

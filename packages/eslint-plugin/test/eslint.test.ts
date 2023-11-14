import { ESLint } from "eslint";
import path from "path";
import stripAnsi from "strip-ansi";
import { fixtureRoot } from "./fixtureTester";

describe("eslint", () => {
  it("should lint", async () => {
    const eslint = new ESLint({
      cwd: fixtureRoot,
      extensions: [".ts", ".cts", "mts"],
      overrideConfig: {
        root: true,
        extends: ["plugin:@definitelytyped/all"],
      },
      useEslintrc: false,
    });
    const results = await eslint.lintFiles(["."]);
    results.sort((a, b) => a.filePath.localeCompare(b.filePath));
    for (const result of results) {
      result.filePath = path.relative(fixtureRoot, result.filePath);
    }
    const formatter = await eslint.loadFormatter("stylish");
    const formatted = await formatter.format(results);
    const resultText = stripAnsi(formatted);
    expect(resultText).toMatchSnapshot("results");
  });
});

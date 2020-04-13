import { summarize } from "../../src/analysis";
const benchmark = require("./fixtures/abbrev.packageBenchmark.json");

describe("analysis", () => {
  describe("summarizePackageBenchmarks", () => {
    test("snapshot", () => {
      expect(summarize(benchmark)).toMatchSnapshot();
    });
  });
});

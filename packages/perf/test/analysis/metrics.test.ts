import { metrics, SignificanceLevel } from "../../src/analysis";
import { Document, PackageBenchmarkSummary, config } from "../../src/common";

describe("analysis", () => {
  describe("metrics", () => {
    test("proportionalTo significance", () => {
      const significance1 = metrics.typeCount.getSignificance(
        6,
        1000,
        6000,
        { body: { testIdentifierCount: 1000, typeCount: 1000 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 6000, typeCount: 6000 } } as Document<PackageBenchmarkSummary>
      );

      expect(significance1).toBe(undefined);

      const significance2 = metrics.typeCount.getSignificance(
        6,
        1000,
        6000,
        { body: { testIdentifierCount: 1000, typeCount: 1000 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 1000, typeCount: 6000 } } as Document<PackageBenchmarkSummary>
      );

      expect(significance2).toBe(SignificanceLevel.Warning);

      const significance3 = metrics.typeCount.getSignificance(
        config.comparison.percentDiffWarningThreshold + 0.01,
        1000,
        200,
        { body: { testIdentifierCount: 1000, typeCount: 1000 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 5000, typeCount: 2000 } } as Document<PackageBenchmarkSummary>
      );

      expect(significance3).toBe(undefined);
    });

    test("withThreshold significance", () => {
      const significance1 = metrics.typeCount.getSignificance(
        6,
        100,
        600,
        { body: { testIdentifierCount: 100, typeCount: 100 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 600, typeCount: 600 } } as Document<PackageBenchmarkSummary>
      );

      expect(significance1).toBe(undefined);
    });
  });
});

import { metrics, SignificanceLevel } from '../../src/analysis';
import { Document, PackageBenchmarkSummary, config } from '../../src/common';

describe('analysis', () => {
  describe('metrics', () => {
    test('type count doesn’t warn unless it’s disproportionately higher with identifier count', () => {
      const significance1 = metrics.typeCount.getSignificance(config.comparison.percentDiffWarningThreshold + .01,
        { body: { testIdentifierCount: 100, typeCount: 100 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 110, typeCount: 110 } } as Document<PackageBenchmarkSummary>);

      expect(significance1).toBe(undefined);

      const significance2 = metrics.typeCount.getSignificance(config.comparison.percentDiffWarningThreshold + .01,
        { body: { testIdentifierCount: 100, typeCount: 100 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 100, typeCount: 110 } } as Document<PackageBenchmarkSummary>);
      
      expect(significance2).toBe(SignificanceLevel.Warning);
    });

    test('type isn’t awesome if it increased, even if it increased much less than identifier count', () => {
      const significance1 = metrics.typeCount.getSignificance(config.comparison.percentDiffWarningThreshold + .01,
        { body: { testIdentifierCount: 100, typeCount: 100 } } as Document<PackageBenchmarkSummary>,
        { body: { testIdentifierCount: 500, typeCount: 200 } } as Document<PackageBenchmarkSummary>);

      expect(significance1).toBe(undefined);
    });
  });
});

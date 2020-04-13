import { PackageBenchmarkSummary, Document } from '../common';
import { getInterestingMetrics, SignificanceLevel } from './metrics';
import { assertNever } from 'types-publisher/bin/util/util';

type BeforeAndAfter = [Document<PackageBenchmarkSummary> | undefined, Document<PackageBenchmarkSummary>];

export enum OverallChange {
  Same = 0,
  Worse = 1 << 0,
  Better = 1 << 1,
  Mixed = Worse | Better,
}

export function getOverallChangeForSingleComparison(before: Document<PackageBenchmarkSummary>, after: Document<PackageBenchmarkSummary>) {
  let change = OverallChange.Same;
  for (const { significance } of getInterestingMetrics(before, after)) {
    switch (significance) {
      case SignificanceLevel.Alert:
      case SignificanceLevel.Warning:
        change |= OverallChange.Worse;
        break;
      case SignificanceLevel.Awesome:
        change |= OverallChange.Better;
        break;
      default:
        assertNever(significance);
    }
  }
  return change;
}

export function getOverallChangeForComparisons(comparisons: BeforeAndAfter[]): OverallChange | undefined {
  let change: OverallChange | undefined = undefined;
  for (const comparison of comparisons) {
    if (comparison[0]) {
      if (change === undefined) {
        change = OverallChange.Same;
      }
      change |= getOverallChangeForSingleComparison(comparison[0], comparison[1]);
    }
  }
  return change;
}
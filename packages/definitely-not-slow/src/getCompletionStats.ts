import { CompletionMeasurement } from './types';
import { max, mean, median } from './utils';

export function getCompletionStats(measurements: CompletionMeasurement[]) {
  const durations = measurements.map(m => m.duration);
  const worst = max(measurements, m => m.duration);
  return {
      mean: mean(durations),
      median: median(durations),
      worst,
  };
}

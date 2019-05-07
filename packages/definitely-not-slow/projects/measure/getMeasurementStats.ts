import { LanguageServiceMeasurement } from '../common';
import { max, mean, median } from './utils';

export function getMeasurementStats(measurements: LanguageServiceMeasurement[]) {
  const durations = measurements.map(m => m.duration);
  const worst = max(measurements, m => m.duration);
  return {
      mean: mean(durations),
      median: median(durations),
      worst,
  };
}

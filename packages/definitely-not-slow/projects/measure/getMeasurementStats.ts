import { LanguageServiceMeasurement } from '../common';
import { max, mean, median } from './utils';

export function getMeasurementStats(measurements: LanguageServiceMeasurement[]) {
  const durations = Array.prototype.concat.apply([], measurements.map(m => m.durations));
  const worst = max(measurements, m => mean(m.durations));
  return {
      mean: mean(durations),
      median: median(durations),
      worst,
  };
}

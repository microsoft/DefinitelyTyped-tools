export function sum(xs: number[]) {
  return xs.reduce((sum, x) => sum + x, 0);
}

export function mean(xs: number[]) {
  return sum(xs) / xs.length;
}

export function max<T>(xs: T[], mapper: (x: T) => number) {
  return xs.reduce((max, x) => mapper(x) > mapper(max) ? x : max, xs[0]);
}

export function median(xs: number[]) {
  const sorted = xs.slice().sort();
  return sorted[Math.floor(xs.length / 2)];
}

export function stdDev(xs: number[]) {
  return Math.sqrt(variance(xs));
}

export function variance(xs: number[]) {
  const avg = mean(xs);
  return mean(xs.map(x => (avg - x) ** 2));
}
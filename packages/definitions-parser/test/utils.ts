export function testo(o: { [s: string]: () => void }) {
  for (const k of Object.keys(o)) {
      test(k, o[k], 100_000);
  }
}

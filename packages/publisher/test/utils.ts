import { test, TestContext } from "node:test";
export function testo(o: { [s: string]: (t: TestContext) => void }) {
  for (const k of Object.keys(o)) {
    test(k, { timeout: 100_000 }, o[k]);
  }
}

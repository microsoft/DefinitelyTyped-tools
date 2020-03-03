import assert from "assert";

export function assertDefined<T>(x: T | undefined, message?: string | Error | undefined): T {
  assert(x !== undefined, message);
  return x!;
}

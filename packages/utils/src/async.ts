import { ProgressBar } from "./progress";
import { initArray } from "./collections";

/** Progress options needed for `nAtATime`. Other options will be inferred. */
interface ProgressOptions<T, U> {
  readonly name: string;
  flavor(input: T, output: U): string | undefined;
}

export async function nAtATime<T, U>(
  n: number,
  inputs: ReadonlyArray<T>,
  use: (t: T) => Awaitable<U>,
  progressOptions?: ProgressOptions<T, U>): Promise<U[]> {
  const progress = progressOptions ? new ProgressBar({ name: progressOptions.name }) : undefined;

  const results = new Array(inputs.length);
  // We have n "threads" which each run `continuouslyWork`.
  // They all share `nextIndex`, so each work item is done only once.
  let nextIndex = 0;
  await Promise.all(initArray(n, async () => {
      while (nextIndex !== inputs.length) {
          const index = nextIndex;
          nextIndex++;
          const input = inputs[index];
          const output = await use(input);
          results[index] = output;
          if (progress) {
              progress!.update(index / inputs.length, progressOptions!.flavor(input, output));
          }
      }
  }));
  if (progress) {
      progress.done();
  }
  return results;
}

export function filter<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): IterableIterator<T> {
  const iter = iterable[Symbol.iterator]();
  return {
      [Symbol.iterator](): IterableIterator<T> { return this; },
      next(): IteratorResult<T> {
          while (true) {
              const res = iter.next();
              if (res.done || predicate(res.value)) {
                  return res;
              }
          }
      },
  };
}

export type Awaitable<T> = T | Promise<T>;

export async function filterNAtATimeOrdered<T>(
  n: number, inputs: ReadonlyArray<T>, shouldKeep: (input: T) => Awaitable<boolean>, progress?: ProgressOptions<T, boolean>): Promise<T[]> {
  const shouldKeeps: boolean[] = await nAtATime(n, inputs, shouldKeep, progress);
  return inputs.filter((_, idx) => shouldKeeps[idx]);
}

export function logUncaughtErrors(promise: Promise<unknown> | (() => Promise<unknown>)): void {
  (typeof promise === "function" ? promise() : promise).catch(error => {
      console.error(error);
      process.exit(1);
  });
}

export function initArray<T>(length: number, makeElement: (i: number) => T): T[] {
  const arr = new Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = makeElement(i);
  }
  return arr;
}

export function mapValues<K, V1, V2>(map: Map<K, V1>, valueMapper: (value: V1) => V2): Map<K, V2> {
  const out = new Map<K, V2>();
  map.forEach((value, key) => {
    out.set(key, valueMapper(value));
  });
  return out;
}

export function mapDefined<T, U>(arr: Iterable<T>, mapper: (t: T) => U | undefined): U[] {
  const out = [];
  for (const a of arr) {
    const res = mapper(a);
    if (res !== undefined) {
      out.push(res);
    }
  }
  return out;
}

export async function mapDefinedAsync<T, U>(arr: Iterable<T>, mapper: (t: T) => Promise<U | undefined>): Promise<U[]> {
  const out = [];
  for (const a of arr) {
    const res = await mapper(a);
    if (res !== undefined) {
      out.push(res);
    }
  }
  return out;
}

export function sort<T>(values: Iterable<T>, comparer?: (a: T, b: T) => number): T[] {
  return Array.from(values).sort(comparer);
}

export function join<T>(values: Iterable<T>, joiner = ", "): string {
  let s = "";
  for (const v of values) {
    s += `${v}${joiner}`;
  }
  return s.slice(0, s.length - joiner.length);
}

/** Returns [values that cb returned undefined for, defined results of cb]. */
export function split<T, U>(inputs: readonly T[], cb: (t: T) => U | undefined): [readonly T[], readonly U[]] {
  const keep: T[] = [];
  const splitOut: U[] = [];
  for (const input of inputs) {
    const res = cb(input);
    if (res === undefined) {
      keep.push(input);
    } else {
      splitOut.push(res);
    }
  }
  return [keep, splitOut];
}

/**
 * Gets the actual offset into an array for a relative offset. Negative offsets indicate a
 * position offset from the end of the array.
 */
function toOffset(array: readonly any[], offset: number) {
  return offset < 0 ? array.length + offset : offset;
}

/**
 * Appends a range of value to an array, returning the array.
 *
 * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
 * is created if `value` was appended.
 * @param from The values to append to the array. If `from` is `undefined`, nothing is
 * appended. If an element of `from` is `undefined`, that element is not appended.
 * @param start The offset in `from` at which to start copying values.
 * @param end The offset in `from` at which to stop copying values (non-inclusive).
 */
export function addRange<T>(to: T[], from: readonly T[] | undefined, start?: number, end?: number): T[];
export function addRange<T>(
  to: T[] | undefined,
  from: readonly T[] | undefined,
  start?: number,
  end?: number
): T[] | undefined;
export function addRange<T>(
  to: T[] | undefined,
  from: readonly T[] | undefined,
  start?: number,
  end?: number
): T[] | undefined {
  if (from === undefined || from.length === 0) return to;
  if (to === undefined) return from.slice(start, end);
  start = start === undefined ? 0 : toOffset(from, start);
  end = end === undefined ? from.length : toOffset(from, end);
  for (let i = start; i < end && i < from.length; i++) {
    if (from[i] !== undefined) {
      to.push(from[i]);
    }
  }
  return to;
}

/**
 * Appends a value to an array, returning the array.
 *
 * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
 * is created if `value` was appended.
 * @param value The value to append to the array. If `value` is `undefined`, nothing is
 * appended.
 */
export function append<TArray extends any[] | undefined, TValue extends NonNullable<TArray>[number] | undefined>(
  to: TArray,
  value: TValue
): [undefined, undefined] extends [TArray, TValue] ? TArray : NonNullable<TArray>[number][];
export function append<T>(to: T[], value: T | undefined): T[];
export function append<T>(to: T[] | undefined, value: T): T[];
export function append<T>(to: T[] | undefined, value: T | undefined): T[] | undefined;
export function append<T>(to: T[] | undefined, value: T | undefined): T[] | undefined {
  if (value === undefined) return to;
  if (to === undefined) return [value];
  to.push(value);
  return to;
}

/**
 * Tests whether a value is an array.
 */
export function isArray(value: any): value is readonly {}[] {
  return Array.isArray ? Array.isArray(value) : value instanceof Array;
}

/**
 * Maps an array. The mapped value is spread into the result.
 *
 * @param array The array to map.
 * @param mapfn The callback used to map the result into one or more values.
 */
export function flatMap<T, U>(array: readonly T[] | undefined, mapfn: (x: T, i: number) => readonly U[]): readonly U[] {
  let result: U[] | undefined;
  if (array) {
    for (let i = 0; i < array.length; i++) {
      result = addRange(result, mapfn(array[i], i));
    }
  }
  return result || [];
}

export function unique<T>(arr: Iterable<T>): T[] {
  return [...new Set(arr)];
}

export function min<T>(array: readonly [T, ...(T | undefined)[]]): T;
export function min<T>(array: readonly T[], compare?: (a: T, b: T) => number): T | undefined;
export function min<T>(array: readonly T[], compare?: (a: T, b: T) => number) {
  return array.length === 0
    ? undefined
    : array.reduce((previousValue, currentValue) =>
        (compare ? compare(currentValue, previousValue) < 0 : currentValue < previousValue)
          ? currentValue
          : previousValue
      );
}

export function max<T>(array: readonly [T, ...(T | undefined)[]]): T;
export function max<T>(array: readonly T[], compare?: (a: T, b: T) => number): T | undefined;
export function max<T>(array: readonly T[], compare?: (a: T, b: T) => number) {
  return array.length === 0
    ? undefined
    : array.reduce((previousValue, currentValue) =>
        (compare ? compare(currentValue, previousValue) > 0 : currentValue > previousValue)
          ? currentValue
          : previousValue
      );
}

export function compact<T>(array: readonly (T | undefined)[]): T[] {
  return array.filter((x): x is T => x !== undefined);
}

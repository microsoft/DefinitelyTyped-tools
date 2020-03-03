export function initArray<T>(length: number, makeElement: (i: number) => T): T[] {
  const arr = new Array(length);
  for (let i = 0; i < length; i++) {
      arr[i] = makeElement(i);
  }
  return arr;
}

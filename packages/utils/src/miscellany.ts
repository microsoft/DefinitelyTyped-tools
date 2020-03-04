export function parseJson(text: string): object {
  try {
      return JSON.parse(text) as object;
  } catch (err) {
      throw new Error(`${(err as Error).message} due to JSON: ${text}`);
  }
}

export function identity<T>(t: T): T { return t; }

export function withoutStart(s: string, start: string): string | undefined {
    return s.startsWith(start) ? s.slice(start.length) : undefined;
}

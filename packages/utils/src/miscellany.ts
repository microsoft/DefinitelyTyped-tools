export function parseJson(text: string): object {
  try {
      return JSON.parse(text) as object;
  } catch (err) {
      throw new Error(`${(err as Error).message} due to JSON: ${text}`);
  }
}
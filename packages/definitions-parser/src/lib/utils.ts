import * as https from "https";

export function getUrlContentsAsString(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    https
      .get(url, res => {
        let data = "";
        res.on("data", d => (data += d));
        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

export function withCache<T>(expiresInMs: number, getValue: () => Promise<T>): () => Promise<T> {
  let value: T | undefined;
  let resolvedAt: number | undefined;
  return async () => {
    if (resolvedAt === undefined || Date.now() - resolvedAt > expiresInMs) {
      value = await getValue();
      resolvedAt = Date.now();
    }
    return value!;
  };
}

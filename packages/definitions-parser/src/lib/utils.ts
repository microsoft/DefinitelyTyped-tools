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

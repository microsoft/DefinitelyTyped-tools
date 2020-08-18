import * as http from "http";

export function getUrlContentsAsString(url: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    http
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

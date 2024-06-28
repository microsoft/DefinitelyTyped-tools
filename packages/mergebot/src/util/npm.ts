import { fetchText } from "./io";

const day = 1000 * 60 * 60 * 24;
const toDateStr = (d: Date, days: number) => new Date(d.getTime() - days * day).toISOString().replace(/T.*$/, "");

export async function getMonthlyDownloadCount(packageName: string, until?: Date): Promise<number> {
  // use the month up to a week before the given date, in case it takes npm some time to update the numbers
  const range = !until ? "last-month" : `${toDateStr(until, 37)}:${toDateStr(until, 7)}`;
  const url = `https://api.npmjs.org/downloads/point/${range}/@types/${packageName}`;
  const result = JSON.parse(await fetchText(url)) as { downloads?: number };
  // For a package not on NPM, just return 0.
  return result.downloads === undefined ? 0 : result.downloads;
}

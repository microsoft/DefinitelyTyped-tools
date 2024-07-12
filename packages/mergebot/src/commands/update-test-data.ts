import * as fs from "fs";
import * as path from "path";
import * as cachedQueries from "../util/cachedQueries";
import { serialize } from "seroval";
// eslint-disable-next-line import/no-extraneous-dependencies
import { format } from "prettier";

async function main() {
  let base = __dirname,
    dataPath = "";
  while (!fs.existsSync((dataPath = path.join(base, "src", "_tests", "cachedQueries.js")))) {
    const up = path.dirname(base);
    if (up === base) throw new Error("Couldn't find cachedQueries.js");
    base = up;
  }

  const data: any = {};

  for (const query in cachedQueries) {
    data[query] = await cachedQueries[query as keyof typeof cachedQueries]();
  }

  const serialized = await format("module.exports = " + serialize(data), { filepath: dataPath });

  await fs.promises.writeFile(dataPath, serialized, "utf8");
}

main().then(
  () => {
    console.log("Done!");
    process.exit(0);
  },
  (err) => {
    if (err?.stack) {
      console.error(err.stack);
    } else {
      console.error(err);
    }
    process.exit(1);
  },
);

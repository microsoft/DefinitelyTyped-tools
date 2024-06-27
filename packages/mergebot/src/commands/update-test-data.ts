import * as fs from "fs";
import * as path from "path";
import * as cachedQueries from "../util/cachedQueries";

async function main() {
    let base = __dirname, dataPath = "";
    while (!fs.existsSync(dataPath = path.join(base, "src", "_tests", "cachedQueries.json"))) {
        const up = path.dirname(base);
        if (up === base) throw new Error("Couldn't find cachedQueries.json");
        base = up;
    }

    const data: any = {};

    for (const query in cachedQueries) {
        data[query] = await cachedQueries[query as keyof typeof cachedQueries]();
    }

    await fs.promises.writeFile(
        dataPath,
        JSON.stringify({ comment: "Generate & update with `npm run update-test-data`", ...data },
                       undefined, 2)
        + "\n",
        "utf8");
}


main().then(() => {
    console.log("Done!");
    process.exit(0);
}, err => {
    if (err?.stack) {
        console.error(err.stack);
    } else {
        console.error(err);
    }
    process.exit(1);
});

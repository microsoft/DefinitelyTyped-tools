const yargs = require("yargs");
const headerParser = require("definitelytyped-header-parser");
const fs = require("fs");
if (!module.parent) {
    const header = headerParser.parseHeaderOrFail(fs.readFileSync(yargs.argv.dts, "utf-8"))
    console.log(JSON.stringify(header));
}

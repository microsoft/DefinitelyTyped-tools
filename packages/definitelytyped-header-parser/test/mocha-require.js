const path = require("path");
require("ts-node").register({
    project: path.join(__dirname, "../tsconfig.json"),
    compiler: path.join(__dirname, "../node_modules/typescript/lib/typescript.js")
});

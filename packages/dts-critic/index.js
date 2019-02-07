const yargs = require("yargs");
const headerParser = require("definitelytyped-header-parser");
const fs = require("fs");
const path = require("path");
const request = require("request-promise-native");

/**
 * @param {string} dtsPath
 * @param {string} [sourcePath]
 */
async function dtsCritic(dtsPath, sourcePath) {
    const dts = fs.readFileSync(dtsPath, "utf-8");
    let header;
    try {
        header = headerParser.parseHeaderOrFail(dts);
    }
    catch(e) {
        header = undefined;
    }
    return findNames(dtsPath, sourcePath, header);
}
dtsCritic.findDtsName = findDtsName;
dtsCritic.findNames = findNames;
dtsCritic.checkOnNpm = checkOnNpm;

module.exports = dtsCritic;
// @ts-ignore
if (!module.parent) {
    main();
}

async function main() {
    const argv = yargs.
        usage("$0 name.d.ts [source-folder]\n\nIf source-folder is not provided, I will look for a matching package on npm.", ).
        help().
        argv;
    if (argv._.length === 0) {
        console.log('Please provide a path to a d.ts file for me to critique.');
        process.exit(1);
    }
    const dts = fs.readFileSync(argv._[0], "utf-8");
    let header;
    try {
        header = headerParser.parseHeaderOrFail(dts);
    }
    catch(e) {
        header = undefined;
    }
    console.log(JSON.stringify(header));

    const names = await findNames(argv._[0], argv._[1], header);
    firstCheck(...names);
}

/**
 * @param {string} dtsPath
 * @param {string} [sourcePath]
 * @param {headerParser.Header=} header
 * @return {Promise<{ dts: string, src: string, headerProject?: string, npmProject?: string}>}
 */
async function findNames(dtsPath, sourcePath, header) {
    const dtsName = findDtsName(dtsPath);
    let sourceName;
    let x;
    if (sourcePath) {
        sourceName = findSourceName(sourcePath);
    }
    else {
        x = await checkOnNpm(dtsName);
        sourceName = dtsName;
    }
    return {
        dts: dtsName,
        src: sourceName,
        header: undefined,
        npm: x
    };
}

/**
 * If dtsName is 'index' (as with DT) then look to the parent directory for the name.
 * @param {string} dtsPath
 */
function findDtsName(dtsPath) {
    const resolved = path.resolve(dtsPath);
    const baseName = path.basename(resolved, '.d.ts');
    if (baseName && baseName !== "index") {
        return baseName;
    }
    return path.basename(path.dirname(resolved));
}

/** @param {string} sourcePath */
function findSourceName(sourcePath) {
    const resolved = path.resolve(sourcePath);
    const hasExtension = !!path.extname(resolved);
    return hasExtension ? path.basename(path.dirname(resolved)) : path.basename(resolved);
}

/**
 * @param {string} baseName
 * @return {Promise<string>}
 */
async function checkOnNpm(baseName) {
    const s = await request("https://registry.npmjs.org" + baseName);
    const result = JSON.parse(s);
    if (result.error) {
        throw new Error(baseName + "does not exist on NPM.");
    }
    else {
        return result.toString();
    }
}

/**
 * We are interested in 3 names for the first check:
 * 1. d.ts file (or folder) name
 * 2. package (or source folder) name
 * 3. header-declared source folder name
 * Also, if (2) is a package from npm, and (3) has a source path, (2)'s source path should agree with (3)'s source path
 *
 * @param {string} dtsName
 * @param {string} sourceName
 * @param {string} [headerSourceName]
 */
function firstCheck(dtsName, sourceName, headerSourceName) {
}

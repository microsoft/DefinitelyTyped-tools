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
    check(await findNames(dtsPath, sourcePath), header);
}
dtsCritic.findDtsName = findDtsName;
dtsCritic.findNames = findNames;
dtsCritic.retrieveNpmHomepageOrFail = retrieveNpmHomepageOrFail;
dtsCritic.check = check;

module.exports = dtsCritic;
// @ts-ignore
if (!module.parent) {
    main().catch(e => { console.log(e); process.exit(1) });
}

/** @typedef {{
 *    dts: string,
 *    src: string,
 *    homepage?: string
 * }}
 * Names
 */

async function main() {
    const argv = yargs.
        usage("$0 name.d.ts [source-folder]\n\nIf source-folder is not provided, I will look for a matching package on npm.", ).
        help().
        argv;
    if (argv._.length === 0) {
        console.log('Please provide a path to a d.ts file for me to critique.');
        process.exit(1);
    }
    let header;
    const dts = fs.readFileSync(argv._[0], "utf-8");
    try {
        header = headerParser.parseHeaderOrFail(dts);
    }
    catch(e) {
        header = undefined;
    }

    check(await findNames(argv._[0], argv._[1]), header);
}

/**
 * @param {string} dtsPath
 * @param {string} [sourcePath]
 * @param {headerParser.Header=} header
 * @return {Promise<Names>}
 */
async function findNames(dtsPath, sourcePath, header) {
    const dts = findDtsName(dtsPath);
    let src;
    let homepage;
    if (sourcePath) {
        src = findSourceName(sourcePath);
    }
    else {
        homepage = await retrieveNpmHomepageOrFail(dts);
        src = dts;
    }
    return { dts, src, homepage };
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
 * This function makes it an ERROR not to have a npm package that matches the base name.
 * @param {string} baseName
 * @return {Promise<string>}
 */
async function retrieveNpmHomepageOrFail(baseName) {
    // TODO: Need to mangle scoped package basenames
    return JSON.parse(await request("https://registry.npmjs.org/" + baseName)).homepage;
}

/**
 * @param {Names} names
 * @param {headerParser.Header} [header]
 */
function check(names, header) {
    if (names.dts !== names.src) {
        throw new Error(`d.ts name is '${names.dts}' but source name is '${names.src}'.`);
    }
    // TODO: Need to skip #readme at end of homepage
    if (names.homepage && header) {
        const homepage = skipEnd(names.homepage, '#readme');
        if (!header.projects.some(p => homepage === p)) {
            throw new Error(`None of the project urls listed in the header match the homepage listed by npm, '${homepage}'.`);
        }
    }
}

/**
 * @param {string} s
 * @param {string} suffix
 */
function skipEnd(s, suffix) {
    if (s.endsWith(suffix)) {
        return s.slice(0, s.length - suffix.length);
    }
    return s;
}

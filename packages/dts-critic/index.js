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
    check(await findNames(dtsPath, sourcePath, header), header);
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
    check(await findNames(argv._[0], argv._[1], header), header);
}

/**
 * @param {string} dtsPath
 * @param {string} [sourcePath]
 * @param {headerParser.Header | undefined} header
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
        src = dts;
        try {
            homepage = await retrieveNpmHomepageOrFail(dts);
            if (header && header.nonNpm) {
                throw new Error(`Non-npm packages must not use names that conflict with existing npm packages.`);
            }
        }
        catch (e) {
            if (!header || !header.nonNpm) {
                throw new Error(`d.ts file must have a matching npm package.
To resolve this error, either:
Add a Definitely Typed header with "// Type definitions for non-npm package ${dts}" as the first line.
Add -browser to the end of your name to make sure it doesn't conflict with existing npm packages.
- OR -
Explicitly provide dts-critic with a source file. This is not allowed for submission to Definitely Typed.`);
            }
        }
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
    return JSON.parse(await request("https://registry.npmjs.org/" + mangleScoped(baseName))).homepage;
}

/** @param {string} baseName */
function mangleScoped(baseName) {
    if (/__/.test(baseName)) {
        return "@" + baseName.replace("__", "/");
    }
    return baseName;
}

/**
 * @param {Names} names
 * @param {headerParser.Header | undefined} header
 */
function check(names, header) {
    if (names.dts !== names.src) {
        throw new Error(`d.ts name '${names.dts}' must match source name '${names.src}'.`);
    }
    if (names.homepage && header) {
        const homepage = normalise(names.homepage);
        if (!header.projects.some(p => homepage === normalise(p))) {
            const e = new Error(`At least one of the project urls listed in the header, ${JSON.stringify(header.projects)}, must match the homepage listed by npm, '${homepage}'.`);
            /** @type {*} */(e).homepage = homepage;
            throw e;
        }
    }
}

/** @param {string} url */
function normalise(url) {
    url = url.toLowerCase();
    url = skipEnd(url, "#readme");
    url = skipEnd(url, "/");
    return url;
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

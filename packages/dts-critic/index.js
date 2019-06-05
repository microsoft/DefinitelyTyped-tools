const yargs = require("yargs");
const headerParser = require("definitelytyped-header-parser");
const fs = require("fs");
const path = require("path");
const download = require("download-file-sync");

/**
 * @param {string} dtsPath
 * @param {string} [sourcePath]
 */
function dtsCritic(dtsPath, sourcePath) {
    const dts = fs.readFileSync(dtsPath, "utf-8");
    let header;
    try {
        header = headerParser.parseHeaderOrFail(dts);
    }
    catch(e) {
        header = undefined;
    }
    const names = findNames(dtsPath, sourcePath, header)
    if (header && !header.nonNpm) {
        checkSource(names.dts, dts, readSource(sourcePath, names.src, header));
    }
}
dtsCritic.findDtsName = findDtsName;
dtsCritic.findNames = findNames;
dtsCritic.retrieveNpmHomepageOrFail = retrieveNpmHomepageOrFail;
dtsCritic.checkSource = checkSource;

module.exports = dtsCritic;
// @ts-ignore
if (!module.parent) {
    main();
}

/** @typedef {{
 *    dts: string,
 *    src: string,
 *    homepage?: string
 * }}
 * Names
 */

function main() {
    const argv = yargs.
        usage("$0 name.d.ts [source-folder]\n\nIf source-folder is not provided, I will look for a matching package on npm.").
        help().
        argv;
    if (argv._.length === 0) {
        console.log("Please provide a path to a d.ts file for me to critique.");
        process.exit(1);
    }
    return dtsCritic(argv._[0], argv._[1]);
}

/**
 * @param {string | undefined} sourcePath
 * @param {string} name
 * @param {headerParser.Header | undefined} header
 */
function readSource(sourcePath, name, header) {
    if (sourcePath) {
        return fs.readFileSync(require.resolve(sourcePath), "utf-8");
    }
    let fullName = mangleScoped(name);
    if (header) {
        fullName += `@${header.libraryMajorVersion}.${header.libraryMinorVersion}`;
    }
    return download("https://unpkg.com/" + fullName);
}

/**
 * Find package names of dts and source. Also finds the homepage from the DT header, if present.
 * @param {string} dtsPath
 * @param {string | undefined} sourcePath
 * @param {headerParser.Header | undefined} header
 * @return {Names}
 */
function findNames(dtsPath, sourcePath, header) {
    const dts = findDtsName(dtsPath);
    let src;
    let homepage;
    if (sourcePath) {
        src = findSourceName(sourcePath);
        if (dts !== src) {
            throw new Error(`d.ts name '${dts}' must match source name '${src}'.`);
        }
    }
    else {
        let nonNpmHasMatchingPackage = false;
        src = dts;
        try {
            homepage = retrieveNpmHomepageOrFail(dts);
            nonNpmHasMatchingPackage = !!header && header.nonNpm && !isExistingSquatter(dts);
        }
        catch (e) {
            if (!header || !header.nonNpm) {
                throw new Error(`d.ts file must have a matching npm package.
To resolve this error, either:
1. Change the name to match an npm package.
2. Add a Definitely Typed header with the first line


    // Type definitions for non-npm package ${dts}-browser

Add -browser to the end of your name to make sure it doesn't conflict with existing npm packages.

- OR -

3. Explicitly provide dts-critic with a source file. This is not allowed for submission to Definitely Typed.
`);
            }
        }
        if (nonNpmHasMatchingPackage) {
            throw new Error(`The non-npm package '${dts}' conflicts with the existing npm package '${dts}'.
Try adding -browser to the end of the name to get

    ${dts}-browser
`);

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
 * @return {string}
 */
function retrieveNpmHomepageOrFail(baseName) {
    const npm = JSON.parse(download("https://registry.npmjs.org/" + mangleScoped(baseName)));
    if ("error" in npm) {
        throw new Error(baseName + " " + npm.error);
    }
    return npm.homepage;
}

/** @param {string} baseName */
function mangleScoped(baseName) {
    if (/__/.test(baseName)) {
        return "@" + baseName.replace("__", "/");
    }
    return baseName;
}

/**
 * A d.ts with 'export default' and no ambient modules should have source that contains
 * either 'default' or '__esModule' or 'react-side-effect' or '@flow' somewhere.
 * This function also skips any package named 'react-native'.
 *
 * Note that this function doesn't follow requires, but just tries to detect
 * 'module.exports = require'
 * @param {string} name
 * @param {string} dts
 * @param {string} src
 */
function checkSource(name, dts, src) {
    if (dts.indexOf("export default") > -1 && dts.indexOf("export =") === -1 && !/declare module ['"]/.test(dts) &&
        src.indexOf("524: A timeout occurred") === -1 && src.indexOf("500 Server Error") === -1 && src.indexOf("Cannot find package") === -1 &&
        !isRealExportDefault(name) && src.indexOf("default") === -1 && src.indexOf("__esModule") === -1 && src.indexOf("react-side-effect") === -1 && src.indexOf("@flow") === -1 && src.indexOf("module.exports = require") === -1) {
        throw new Error(`The types for ${name} specify 'export default' but the source does not mention 'default' anywhere.
Here is the source:
${src}`);
    }
}

/** @param {string} name */
function isExistingSquatter(name) {
    return name === "atom" ||
        name === "ember__string" ||
        name === "fancybox" ||
        name === "jsqrcode" ||
        name === "node" ||
        name === "geojson" ||
        name === "titanium";
}

/** @param {string} name */
function isRealExportDefault(name) {
    return name.indexOf("react-native") > -1 ||
        name === "ember-feature-flags" ||
        name === "material-ui-datatables";
}

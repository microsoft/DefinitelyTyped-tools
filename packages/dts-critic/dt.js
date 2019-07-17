const critic = require('./index')
const fs = require('fs')
const path = require('path')
const stripJsonComments = require('strip-json-comments')
/** @param {string} tslintPath */
function hasNpmNamingLintRule(tslintPath) {
    if (fs.existsSync(tslintPath)) {
        const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, 'utf-8')))
        if(tslint.rules && tslint.rules["npm-naming"] !== undefined) {
            return !!tslint.rules["npm-naming"]
        }
        return true;
    }
    return false;
}

/** @param {string} tslintPath */
function addNpmNamingLintRule(tslintPath) {
    if (fs.existsSync(tslintPath)) {
        const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, 'utf-8')))
        if (tslint.rules) {
            tslint.rules["npm-naming"] = false;
        }
        else {
            tslint.rules = { "npm-naming": false }
        }
        fs.writeFileSync(tslintPath, JSON.stringify(tslint, undefined, 4), 'utf-8')
    }
}

function main() {
    for (const item of fs.readdirSync('../DefinitelyTyped/types')) {
        const entry = '../DefinitelyTyped/types/' + item
        try {
            if (hasNpmNamingLintRule(entry + '/tslint.json')) {
                critic(entry + '/index.d.ts')
            }
        }
        catch (e) {
            if (/d.ts file must have a matching npm package/.test(e.message)) {
                console.log(`No matching npm package found for ` + item)
                // const re = /\/\/ Type definitions for/;
                // const s = fs.readFileSync(entry + '/index.d.ts', 'utf-8')
                // fs.writeFileSync(entry + '/index.d.ts', s.replace(re, '// Type definitions for non-npm package'), 'utf-8')
            }
            else if (/At least one of the project urls listed in the header/.test(e.message)) {
                console.log('trying to add ' + e.homepage + '...')
                const re = /\/\/ Project: (.+)/;
                const s = fs.readFileSync(entry + '/index.d.ts', 'utf-8')
                fs.writeFileSync(entry + '/index.d.ts', s.replace(re, '// Project: $1, ' + e.homepage), 'utf-8')
            }
            else if (/but the source does not mention 'default'/.test(e.message)) {
                console.log('converting', item, 'to export = ...')
                const named = /export default function\s+(\w+\s*)\(/;
                const anon = /export default function\s*\(/;
                const id = /export default(\s+\w+);/;
                let s = fs.readFileSync(entry + '/index.d.ts', 'utf-8')
                s = s.replace(named, 'export = $1;\ndeclare function $1(')
                s = s.replace(anon, 'export = _default;\ndeclare function _default(')
                s = s.replace(id, 'export =$1;')
                fs.writeFileSync(entry + '/index.d.ts', s, 'utf-8')
            }
            else if (/must match a version that exists on npm/.test(e.message)) {
                const m = /** @type {string} */(e.message).match(/in the header, ([0-9.]+), to match one on npm, ([0-9., ]+)\./)
                if (m) {
                    const headerver = parseFloat(m[1])
                    const npmvers = m[2].split(',').map(s => parseFloat(s.trim()))
                    const fixto = npmvers.every(v => headerver > v) ? -1.0 : Math.max(...npmvers)
                    console.log(`npm-version:${item}:${m[1]}:${m[2]}:${fixto}`)
                    addNpmNamingLintRule(entry + '/tslint.json')
                }
                else {
                    console.log('could not parse error message: ', e.message)
                }
            }
            else {
                console.log('*** ERROR for ' + item + ' ***')
                console.log(e)
            }
        }
    }
}
main()

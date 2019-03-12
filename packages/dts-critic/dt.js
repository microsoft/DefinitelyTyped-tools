const critic = require('./index')
const fs = require('fs')
const path = require('path')
const stripJsonComments = require('strip-json-comments')
/** @param {string} tslintPath */
function hasDtHeaderLintRule(tslintPath) {
    if (fs.existsSync(tslintPath)) {
        const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, 'utf-8')))
        if(tslint.rules && tslint.rules["dt-header"] !== undefined) {
            return !!tslint.rules["dt-header"]
        }
        return true;
    }
    return false;
}

function main() {
    for (const item of fs.readdirSync('../DefinitelyTyped/types')) {
        const entry = '../DefinitelyTyped/types/' + item
        try {
            if (hasDtHeaderLintRule(entry + '/tslint.json')) {
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
            else {
                console.log('*** ERROR for ' + item + ' ***')
                console.log(e)
            }
        }
    }
}
main()

const critic = require('./index')
const fs = require('fs')
const path = require('path')
const stripJsonComments = require('strip-json-comments')
/** @param {string} tslintPath */
async function hasDtHeaderLintRule(tslintPath) {
    if(fs.existsSync(tslintPath)) {
        const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, 'utf-8')))
        if(tslint.rules && tslint.rules["dt-header"]) {
            return !!tslint.rules["dt-header"]
        }
        return true;
    }
    return false;
}


async function main() {
    for (const item of fs.readdirSync('../DefinitelyTyped/types')) {
        const entry = '../DefinitelyTyped/types/' + item
        try {
            if (await hasDtHeaderLintRule(entry + '/tslint.json')) {
                await critic(entry + '/index.d.ts')
            }
        }
        catch (e) {
            const s = JSON.stringify(e);
            if (/StatusCodeError/.test(s)) {
                console.log(`No matching npm package found for ` + item)
            }
            else {
                console.log('*** ERROR for ' + item + ' ***')
                console.log(e)
            }
        }
    }
}
main()

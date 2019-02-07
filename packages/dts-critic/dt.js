const critic = require('./index')
const fs = require('fs')
async function main() {
    for (const item of fs.readdirSync('../DefinitelyTyped/types')) {
        try {
            await critic('../DefinitelyTyped/types/' + item + '/index.d.ts')
        }
        catch (e) {
            const s = JSON.stringify(e);
            if (/StatusCodeError/.test(s)) {
                console.log(`No matching npm package found for ` + item);
            }
            else {
                console.log('*** ERROR for ' + item + ' ***')
                console.log(e)
            }
        }
    }
}
main()

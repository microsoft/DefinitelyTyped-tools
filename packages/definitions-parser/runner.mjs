import { loggerWithErrors } from "@definitelytyped/utils";
import { checkParseResults } from './dist/check-parse-results.js'
import { getDefinitelyTyped } from './dist/index.js'
import utils from '@definitelytyped/utils'
const options = {
    definitelyTypedPath: "../../../DefinitelyTyped",
    progress: true,
    parseInParallel: true,
};

const client = new utils.UncachedNpmInfoClient();
const [log] = loggerWithErrors();
const dt = await getDefinitelyTyped(options, log);
await checkParseResults(true, dt, options, client)

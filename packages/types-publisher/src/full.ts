import * as yargs from "yargs";

import calculateVersions from "./calculate-versions";
import checkParseResults from "./check-parse-results";
import clean from "./clean";
import createSearchIndex from "./create-search-index";
import generatePackages from "./generate-packages";
import getDefinitelyTyped from "./get-definitely-typed";
import { Options } from "./lib/common";
import NpmClient from "./lib/npm-client";
import parseDefinitions from "./parse-definitions";
import publishPackages from "./publish-packages";
import publishRegistry from "./publish-registry";
import uploadBlobs from "./upload-blobs";
import { currentTimeStamp, done } from "./util/util";
import validate from "./validate";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	done(NpmClient.create()
		.then(client => full(client, dry, currentTimeStamp(), Options.defaults)));
}

export default async function full(client: NpmClient, dry: boolean, timeStamp: string, options: Options): Promise<void> {
	await clean();
	await getDefinitelyTyped(options);
	await parseDefinitions(options);
	await checkParseResults(/*includeNpmChecks*/ false, options);
	await calculateVersions(/*forceUpdate*/ false, options);
	await generatePackages(options);
	await createSearchIndex(/*skipDownloads*/ false, /*full*/ false, options);
	await publishPackages(client, dry, options);
	await publishRegistry();
	await validate(options);
	if (!dry) {
		await uploadBlobs(timeStamp);
	}
}

import * as yargs from "yargs";

import clean from "./clean";
import getDefinitelyTyped from "./get-definitely-typed";
import parseDefinitions from "./parse-definitions";
import checkParseResults from "./check-parse-results";
import calculateVersions from "./calculate-versions";
import generatePackages from "./generate-packages";
import createSearchIndex from "./create-search-index";
import publishPackages from "./publish-packages";
import publishRegistry from "./publish-registry";
import uploadBlobs from "./upload-blobs";
import validate from "./validate";
import { Options } from "./lib/common";
import NpmClient from "./lib/npm-client";
import { currentTimeStamp, done } from "./util/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	done(NpmClient.create()
		.then(client => full(client, dry, currentTimeStamp(), Options.defaults)));
}

export default async function full(client: NpmClient, dry: boolean, timeStamp: string, options: Options): Promise<void> {
	await clean();
	await getDefinitelyTyped(options);
	await parseDefinitions(options);
	await checkParseResults(/*includeNpmChecks*/ false);
	await calculateVersions(/*forceUpdate*/ false, options);
	await generatePackages(options);
	await createSearchIndex(/*skipDownloads*/ false, /*full*/ false);
	await publishPackages(client, dry, options);
	await publishRegistry();
	await validate(options);
	if (!dry) {
		await uploadBlobs(timeStamp);
	}
}

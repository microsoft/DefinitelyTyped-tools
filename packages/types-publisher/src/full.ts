import * as yargs from "yargs";

import calculateVersions from "./calculate-versions";
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
import { Fetcher } from "./util/io";
import { currentTimeStamp, done, numberOfOsProcesses } from "./util/util";
import validate from "./validate";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	done(NpmClient.create()
		.then(client => full(client, dry, currentTimeStamp(), Options.defaults, new Fetcher())));
}

export default async function full(client: NpmClient, dry: boolean, timeStamp: string, options: Options, fetcher: Fetcher): Promise<void> {
	await clean();
	await getDefinitelyTyped(options);
	await parseDefinitions(options, /*nProcesses*/ numberOfOsProcesses);
	await calculateVersions(/*forceUpdate*/ false, fetcher, options);
	await generatePackages(options);
	await createSearchIndex(/*skipDownloads*/ false, /*full*/ false, fetcher, options);
	await publishPackages(client, dry, options);
	await publishRegistry(options, dry, fetcher);
	await validate(options);
	if (!dry) {
		await uploadBlobs(timeStamp);
	}
}

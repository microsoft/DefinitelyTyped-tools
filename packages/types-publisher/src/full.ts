import * as yargs from "yargs";

import calculateVersions from "./calculate-versions";
import clean from "./clean";
import createSearchIndex from "./create-search-index";
import generatePackages from "./generate-packages";
import getDefinitelyTyped from "./get-definitely-typed";
import { Options } from "./lib/common";
import { UncachedNpmInfoClient } from "./lib/npm-client";
import parseDefinitions from "./parse-definitions";
import publishPackages from "./publish-packages";
import publishRegistry from "./publish-registry";
import uploadBlobs from "./upload-blobs";
import { currentTimeStamp, done, numberOfOsProcesses } from "./util/util";
import validate from "./validate";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	done(full(dry, currentTimeStamp(), Options.defaults));
}

export default async function full(dry: boolean, timeStamp: string, options: Options): Promise<void> {
	const infoClient = new UncachedNpmInfoClient();
	await clean();
	await getDefinitelyTyped(options);
	await parseDefinitions(options, /*nProcesses*/ numberOfOsProcesses);
	await calculateVersions(/*forceUpdate*/ false, options, infoClient);
	await generatePackages(options);
	await createSearchIndex(/*skipDownloads*/ false, /*full*/ false, infoClient, options);
	await publishPackages(dry, options);
	await publishRegistry(options, dry, infoClient);
	await validate(options);
	if (!dry) {
		await uploadBlobs(timeStamp);
	}
}

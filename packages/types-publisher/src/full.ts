import * as yargs from "yargs";
import clean from "./clean";
import getDefinitelyTyped from "./get-definitely-typed";
import parseDefinitions from "./parse-definitions";
import checkParseResults from "./check-parse-results";
import generatePackages from "./generate-packages";
import createSearchIndex from "./create-search-index";
import publishPackages from "./publish-packages";
import uploadBlobs from "./upload-blobs";
import { currentTimeStamp } from "./lib/util";

if (!module.parent) {
	const dry = !!yargs.argv.dry;
	full(dry, currentTimeStamp()).then(() => console.log("Done!")).catch(console.error);
}

export default async function full(dry: boolean, timeStamp: string): Promise<void> {
	await clean();
	await getDefinitelyTyped();
	await parseDefinitions();
	checkParseResults();
	await generatePackages(/*forceUpdate*/ false);
	await createSearchIndex(/*skipDownloads*/ false);
	await publishPackages(dry);
	if (!dry) {
		await uploadBlobs(timeStamp);
	}
}

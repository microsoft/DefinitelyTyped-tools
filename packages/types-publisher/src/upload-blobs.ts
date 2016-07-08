import uploadBlobs from "./lib/blob-uploader";
import { currentTimeStamp } from "./lib/util";

if (!module.parent) {
	uploadBlobs(currentTimeStamp()).catch(console.error);
}

export default uploadBlobs;

import uploadBlobs from "./lib/blob-uploader";
import { currentTimeStamp, done } from "./lib/util";

if (!module.parent) {
	done(uploadBlobs(currentTimeStamp()));
}

export default uploadBlobs;

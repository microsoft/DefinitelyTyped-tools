import uploadBlobsAndUpdateIssue from "./lib/blob-uploader";
import { currentTimeStamp, logUncaughtErrors } from "./util/util";

if (!module.parent) {
    logUncaughtErrors(uploadBlobsAndUpdateIssue(currentTimeStamp()));
}

export default uploadBlobsAndUpdateIssue;

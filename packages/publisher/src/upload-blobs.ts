import uploadBlobsAndUpdateIssue from "./lib/blob-uploader";
import { currentTimeStamp } from "./util/util";
import { logUncaughtErrors } from "@definitelytyped/utils";

if (!module.parent) {
    logUncaughtErrors(uploadBlobsAndUpdateIssue(currentTimeStamp()));
}

export default uploadBlobsAndUpdateIssue;

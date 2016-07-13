import assert = require("assert");
import * as fsp from "fs-promise";
import * as path from "path";
import * as container from "./azure-container";
import { Logger, ArrayLog, writeLogSync } from "./common";
import updateIssue from "./issue-updater";

const maxNumberOfOldLogsDirectories = 5;
const githubAccessToken = process.env.GITHUB_ACCESS_TOKEN;

export default async function uploadBlobsAndUpdateIssue(timeStamp: string): Promise<void> {
	const [dataUrls, logUrls] = await uploadBlobs(timeStamp);
	await updateIssue(githubAccessToken, timeStamp, dataUrls, logUrls);
};

// View uploaded files at:
// https://ms.portal.azure.com/?flight=1#resource/subscriptions/99160d5b-9289-4b66-8074-ed268e739e8e/resourceGroups/types-publisher/providers/Microsoft.Storage/storageAccounts/typespublisher
async function uploadBlobs(timeStamp: string): Promise<[string[], string[]]> {
	await container.ensureCreated({ publicAccessLevel: "blob" });
	const logger = new ArrayLog();
	const [dataUrls, logUrls] = await Promise.all([
		await uploadDirectory("data", "data", logger),
		await uploadLogs(timeStamp, logger)
	]);

	// Finally, output blob logs and upload them.
	const blobLogs = "logs/upload-blobs.md";
	const {infos, errors} = logger.result();
	assert(!errors.length);
	writeLogSync(blobLogs, infos);
	const uploadBlobsLogName = logsUploadedLocation(timeStamp) + "/upload-blobs.md";
	await container.createBlobFromFile(uploadBlobsLogName, blobLogs);

	logUrls.push(container.urlOfBlob(uploadBlobsLogName));
	return [dataUrls, logUrls];
};

const logsDirectoryName = "logs";
const logsPrefix = logsDirectoryName + "/";

function logsUploadedLocation(timeStamp: string) {
	return logsPrefix + timeStamp;
}

async function uploadLogs(timeStamp: string, log: Logger): Promise<string[]> {
	await removeOldDirectories(logsPrefix, maxNumberOfOldLogsDirectories - 1, log);
	return await uploadDirectory(logsUploadedLocation(timeStamp), logsDirectoryName, log, f => f !== "upload-blobs.md");
}

async function uploadDirectory(uploadedDirPath: string, dirPath: string, log: Logger, filter?: (fileName: string) => boolean): Promise<string[]> {
	let files = await fsp.readdir(dirPath);
	if (filter) {
		files = files.filter(filter);
	}
	return await Promise.all(files.map(async fileName => {
		const fullPath = path.join(dirPath, fileName);
		const blobName = `${uploadedDirPath}/${fileName}`;
		await logAndUpload(blobName, fullPath, log);
		return container.urlOfBlob(blobName);
	}));
}

function logAndUpload(blobName: string, filePath: string, log: Logger): Promise<void> {
	const url = container.urlOfBlob(blobName);
	log.info(`Uploading ${filePath} to ${url}`);
	return container.createBlobFromFile(blobName, filePath).then(() => {});
}

async function deleteDirectory(uploadedDirPath: string, log: Logger): Promise<void> {
	const blobs = await container.listBlobs(uploadedDirPath);
	const blobNames = blobs.map(b => b.name);
	log.info(`Deleting directory ${uploadedDirPath}: delete files ${blobNames}`);
	await Promise.all(blobNames.map(b => container.deleteBlob(b)));
}

async function removeOldDirectories(prefix: string, maxDirectories: number, log: Logger): Promise<void> {
	const list = await container.listBlobs(prefix);

	const dirNames = unique(list.map(({name}) => {
		assert(name.startsWith(prefix));
		return path.dirname(name.slice(prefix.length));
	}));

	if (dirNames.length <= maxDirectories) {
		log.info(`No need to remove old directories: have ${dirNames.length}, can go up to ${maxDirectories}.`);
		return;
	}

	// For ISO 8601 times, sorting lexicographically *is* sorting by time.
	const sortedNames = dirNames.sort();
	const toDelete = sortedNames.slice(0, sortedNames.length - maxDirectories);

	log.info(`Too many old logs, so removing the following directories: [${toDelete}]`);
	await Promise.all(toDelete.map(d => deleteDirectory(prefix + d, log)));
}

function unique<T>(arr: T[]) {
	return [...new Set(arr)];
}

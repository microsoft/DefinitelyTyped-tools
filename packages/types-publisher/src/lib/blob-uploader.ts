import assert = require("assert");
import * as fsp from "fs-promise";
import * as path from "path";
import Container from "./azure-container";
import { Logger, ArrayLog } from "./common";

const container = new Container("typespublisher");
const maxNumberOfOldLogsDirectories = 5;

// View uploaded files at:
// https://ms.portal.azure.com/?flight=1#resource/subscriptions/99160d5b-9289-4b66-8074-ed268e739e8e/resourceGroups/types-publisher/providers/Microsoft.Storage/storageAccounts/typespublisher
export default async function uploadBlobs() {
	await container.ensureCreated({ publicAccessLevel: "blob" });
	const logger = new ArrayLog();
	const timeStamp = new Date().toISOString();
	await Promise.all([
		uploadDirectory("data", "data", logger),
		uploadLogs(timeStamp, logger)
	]);

	// Finally, output blob logs and upload them.
	const blobLogs = "logs/upload-blobs.md";
	const {infos, errors} = logger.result();
	assert(!errors.length);
	await fsp.writeFile(blobLogs, infos.join("\r\n") + "\r\n", { encoding: "utf8" });
	await container.createBlobFromFile(logsUploadedLocation(timeStamp) + "/upload-blobs.md", blobLogs);
};

const logsDirectoryName = "logs";
const logsPrefix = logsDirectoryName + "/";

function logsUploadedLocation(timeStamp: string) {
	return logsPrefix + timeStamp;
}

async function uploadLogs(timeStamp: string, log: Logger): Promise<void> {
	await removeOldDirectories(logsPrefix, maxNumberOfOldLogsDirectories - 1, log);
	await uploadDirectory(logsUploadedLocation(timeStamp), logsDirectoryName, log);
}

async function uploadDirectory(uploadedDirPath: string, dirPath: string, log: Logger): Promise<void> {
	const files = await fsp.readdir(dirPath);
	await Promise.all(files.map(fileName => {
		const fullPath = path.join(dirPath, fileName);
		const blobName = `${uploadedDirPath}/${fileName}`;
		return logAndUpload(blobName, fullPath, log);
	}));
}

function logAndUpload(blobName: string, filePath: string, log: Logger): Promise<void> {
	const url = container.urlOfBlob(blobName);
	log.info(`Uploading ${filePath} to ${url}`);
	return container.createBlobFromFile(blobName, filePath);
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
		const lastSlash = name.lastIndexOf("/");
		assert(lastSlash !== -1);
		return name.slice(prefix.length, lastSlash);
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

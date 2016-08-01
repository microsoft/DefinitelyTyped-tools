import assert = require("assert");
import * as fsp from "fs-promise";
import * as path from "path";
import * as container from "./azure-container";
import { Logger, ArrayLog, logPath, writeLog } from "./common";
import { unique } from "./util";

const maxNumberOfOldLogsDirectories = 5;

export default async function uploadBlobsAndUpdateIssue(timeStamp: string): Promise<void> {
	await container.ensureCreated({ publicAccessLevel: "blob" });
	await container.setCorsProperties();
	const [dataUrls, logUrls] = await uploadBlobs(timeStamp);
	await uploadIndex(timeStamp, dataUrls, logUrls);
};

// View uploaded files at:
// https://ms.portal.azure.com/?flight=1#resource/subscriptions/99160d5b-9289-4b66-8074-ed268e739e8e/resourceGroups/types-publisher/providers/Microsoft.Storage/storageAccounts/typespublisher
async function uploadBlobs(timeStamp: string): Promise<[string[], string[]]> {
	const logger = new ArrayLog();
	const [dataUrls, logUrls] = await Promise.all([
		await uploadDirectory("data", "data", logger),
		await uploadLogs(timeStamp, logger)
	]);

	// Finally, output blob logs and upload them.
	const blobLogs = "upload-blobs.md";
	const {infos, errors} = logger.result();
	assert(!errors.length);
	await writeLog(blobLogs, infos);
	logUrls.push(await uploadFile(logsUploadedLocation(timeStamp) + "/" + blobLogs, logPath(blobLogs)));

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
	return await Promise.all(files.map(fileName => {
		const fullPath = path.join(dirPath, fileName);
		const blobName = `${uploadedDirPath}/${fileName}`;
		return logAndUploadFile(blobName, fullPath, log);
	}));
}

async function logAndUploadFile(blobName: string, filePath: string, log: Logger): Promise<string> {
	const url = container.urlOfBlob(blobName);
	log.info(`Uploading ${filePath} to ${url}`);
	await container.createBlobFromFile(blobName, filePath);
	return url;
}
async function uploadFile(blobName: string, filePath: string): Promise<string> {
	const url = container.urlOfBlob(blobName);
	await container.createBlobFromFile(blobName, filePath);
	return url;
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

// Provides links to the latest blobs.
// These are at: https://typespublisher.blob.core.windows.net/typespublisher/index.html
function uploadIndex(timeStamp: string, dataUrls: string[], logUrls: string[]): Promise<void> {
	return container.createBlobFromText("index.html", createIndex());

	function createIndex(): string {
		const lines: string[] = [];
		lines.push("<html><head></head><body>");
		lines.push(`<h3>Here is the latest data as of **${timeStamp}**:</h3>`);
		lines.push("<h4>Data</h4>");
		lines.push(...dataUrls.map(link));
		lines.push("<h4>Logs</h4>");
		lines.push(...logUrls.map(link));
		lines.push("</body></html>");
		return lines.join("\n");

		function link(url: string): string {
			const short = url.slice(url.lastIndexOf("/") + 1);
			return `<li><a href='${url}'>${short}</a></li>`;
		}
	}
}

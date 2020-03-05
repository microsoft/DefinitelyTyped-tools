import assert = require("assert");
import { readdir } from "fs-extra";
import * as path from "path";
import { logger, writeLog, logPath, Logger, joinPaths, unique } from "@definitelytyped/utils";
import BlobWriter, { urlOfBlob } from "./azure-container";

const maxNumberOfOldLogsDirectories = 5;

export default async function uploadBlobsAndUpdateIssue(timeStamp: string): Promise<void> {
    const container = await BlobWriter.create();
    await container.ensureCreated({ publicAccessLevel: "blob" });
    await container.setCorsProperties();
    const [dataUrls, logUrls] = await uploadBlobs(container, timeStamp);
    await uploadIndex(container, timeStamp, dataUrls, logUrls);
}

// View uploaded files at: https://ms.portal.azure.com under "typespublisher"
async function uploadBlobs(container: BlobWriter, timeStamp: string): Promise<[string[], string[]]> {
    const [log, logResult] = logger();
    const [dataUrls, logUrls] = await Promise.all([
        await uploadDirectory(container, "data", "data", log),
        await uploadLogs(container, timeStamp, log),
    ]);

    // Finally, output blob logs and upload them.
    const blobLogs = "upload-blobs.md";
    await writeLog(blobLogs, logResult());
    logUrls.push(await uploadFile(container, `${logsUploadedLocation(timeStamp)}/${blobLogs}`, logPath(blobLogs)));

    return [dataUrls, logUrls];
}

const logsDirectoryName = "logs";
const logsPrefix = `${logsDirectoryName}/`;

function logsUploadedLocation(timeStamp: string): string {
    return logsPrefix + timeStamp;
}

async function uploadLogs(container: BlobWriter, timeStamp: string, log: Logger): Promise<string[]> {
    await removeOldDirectories(container, logsPrefix, maxNumberOfOldLogsDirectories - 1, log);
    return uploadDirectory(container, logsUploadedLocation(timeStamp), logsDirectoryName, log, f => f !== "upload-blobs.md");
}

async function uploadDirectory(
    container: BlobWriter, uploadedDirPath: string, dirPath: string, log: Logger,
    filter?: (fileName: string) => boolean): Promise<string[]> {

    let files = await readdir(dirPath);
    if (filter) {
        files = files.filter(filter);
    }
    return Promise.all(files.map(fileName => {
        const fullPath = joinPaths(dirPath, fileName);
        const blobName = joinPaths(uploadedDirPath, fileName);
        return logAndUploadFile(container, blobName, fullPath, log);
    }));
}

async function logAndUploadFile(container: BlobWriter, blobName: string, filePath: string, log: Logger): Promise<string> {
    const url = urlOfBlob(blobName);
    log(`Uploading ${filePath} to ${url}`);
    await container.createBlobFromFile(blobName, filePath);
    return url;
}
async function uploadFile(container: BlobWriter, blobName: string, filePath: string): Promise<string> {
    const url = urlOfBlob(blobName);
    await container.createBlobFromFile(blobName, filePath);
    return url;
}

async function deleteDirectory(container: BlobWriter, uploadedDirPath: string, log: Logger): Promise<void> {
    const blobs = await container.listBlobs(uploadedDirPath);
    const blobNames = blobs.map(b => b.name);
    log(`Deleting directory ${uploadedDirPath}: delete files ${blobNames.toString()}`);
    await Promise.all(blobNames.map(b => container.deleteBlob(b)));
}

async function removeOldDirectories(container: BlobWriter, prefix: string, maxDirectories: number, log: Logger): Promise<void> {
    const list = await container.listBlobs(prefix);

    const dirNames = unique(list.map(({name}) => {
        assert(name.startsWith(prefix));
        return path.dirname(name.slice(prefix.length));
    }));

    if (dirNames.length <= maxDirectories) {
        log(`No need to remove old directories: have ${dirNames.length}, can go up to ${maxDirectories}.`);
        return;
    }

    // For ISO 8601 times, sorting lexicographically *is* sorting by time.
    const sortedNames = dirNames.sort();
    const toDelete = sortedNames.slice(0, sortedNames.length - maxDirectories);

    log(`Too many old logs, so removing the following directories: [${toDelete.toString()}]`);
    await Promise.all(toDelete.map(d => deleteDirectory(container, prefix + d, log)));
}

// Provides links to the latest blobs.
// These are at: https://typespublisher.blob.core.windows.net/typespublisher/index.html
function uploadIndex(container: BlobWriter, timeStamp: string, dataUrls: ReadonlyArray<string>, logUrls: ReadonlyArray<string>): Promise<void> {
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

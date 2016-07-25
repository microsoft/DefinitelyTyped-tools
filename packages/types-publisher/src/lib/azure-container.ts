import { BlobResult, ContainerResult, ContinuationToken, CreateBlobRequestOptions, CreateContainerOptions, ErrorOrResponse, ErrorOrResult, ListBlobsResult, ServicePropertiesResult, createBlobService } from "azure-storage";
import * as fs from "fs";
import { IncomingMessage } from "http";
import * as https from "https";
import * as stream from "stream";
import * as zlib from "zlib";
import { settings } from "./common";
import { parseJson } from "./util";

const name = settings.azureContainer;
const service = createBlobService(settings.azureStorageAccount, process.env["AZURE_STORAGE_ACCESS_KEY"]);

export function setCorsProperties(): Promise<void> {
	const properties: ServicePropertiesResult.ServiceProperties = {
		Cors: {
			CorsRule: [
				{
					AllowedOrigins: ["*"],
					AllowedMethods: ["GET"],
					AllowedHeaders: [],
					ExposedHeaders: [],
					MaxAgeInSeconds: 60 * 60 * 24 // 1 day
				}
			]
		}
	};
	return promisifyErrorOrResponse(cb => service.setServiceProperties(properties, cb));
}

export function ensureCreated(options: CreateContainerOptions): Promise<void> {
	return promisifyErrorOrResult<ContainerResult>(cb => service.createContainerIfNotExists(name, options, cb)).then(() => {});
}

export async function createBlobFromFile(blobName: string, fileName: string): Promise<void> {
	return createBlobFromStream(blobName, fs.createReadStream(fileName));
}

export async function createBlobFromText(blobName: string, text: string): Promise<void> {
	return createBlobFromStream(blobName, streamOfString(text));
}

function createBlobFromStream(blobName: string, stream: NodeJS.ReadableStream): Promise<void> {
	const options: CreateBlobRequestOptions =  {
		contentSettings: {
			contentEncoding: "GZIP",
			contentType: "application/json; charset=utf-8"
		}
	};
	return streamDone(gzip(stream).pipe(service.createWriteStreamToBlockBlob(name, blobName, options)));
}

function streamOfString(text: string): NodeJS.ReadableStream {
	const s = new stream.Readable();
	s.push(text);
	s.push(null);
	return s;
}

function gzip(input: NodeJS.ReadableStream): zlib.Gzip {
	return input.pipe(zlib.createGzip());
}

function streamDone(stream: NodeJS.WritableStream): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		stream.on("error", reject).on("finish", resolve);
	});
}

export async function readBlob(blobName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const url = urlOfBlob(blobName);
		const req = https.get(url, res => {
			switch (res.statusCode) {
				case 200:
					readResponse(res);
				default:
					reject(new Error(`Can't get ${url}`));
			}
		});
		req.on("error", reject);

		function readResponse(res: IncomingMessage): void {
			if (res.headers["content-encoding"] !== "GZIP") {
				reject(new Error(`${url} is not gzipped`));
			}
			const output = zlib.createGunzip();
			res.pipe(output);
			let body = "";
			output.on("data", (data: Buffer) => {
				body += data.toString("utf8");
			});
			output.on("error", () => reject());
			output.on("end", () => resolve(body));
		}
	});
}

export async function readJsonBlob(blobName: string): Promise<any> {
	return parseJson(await readBlob(blobName));
}

export async function listBlobs(prefix: string): Promise<BlobResult[]> {
	const once = (token: ContinuationToken | null) =>
		promisifyErrorOrResult<ListBlobsResult>(cb => service.listBlobsSegmentedWithPrefix(name, prefix, token, cb));

	const out: BlobResult[] = [];
	let token: ContinuationToken | null = null;
	do {
		const {entries, continuationToken} = await once(token);
		out.push(...entries);
		token = continuationToken;
	} while (token);

	return out;
}

export function deleteBlob(blobName: string): Promise<void> {
	return promisifyErrorOrResponse(cb => service.deleteBlob(name, blobName, cb));
}

export function urlOfBlob(blobName: string): string {
	return `https://${name}.blob.core.windows.net/${name}/${blobName}`;
}

function promisifyErrorOrResult<A>(callsBack: (x: ErrorOrResult<A>) => void): Promise<A> {
	return new Promise<A>((resolve, reject) => {
		callsBack((err, result, response) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(result);
			}
		});
	});
}

function promisifyErrorOrResponse(callsBack: (x: ErrorOrResponse) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		callsBack((err, response) => {
			if (err) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}

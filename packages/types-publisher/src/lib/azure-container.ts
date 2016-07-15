import { BlobResult, ContainerResult, ContinuationToken, CreateBlobRequestOptions, CreateContainerOptions, ErrorOrResponse, ErrorOrResult, ListBlobsResult, createBlobService } from "azure-storage";
import { settings } from "./common";

const name = settings.azureContainer;
const service = createBlobService();

export function ensureCreated(options: CreateContainerOptions): Promise<void> {
	return promisifyErrorOrResult<ContainerResult>(cb => service.createContainerIfNotExists(name, options, cb)).then(() => {});
}

export function createBlobFromFile(blobName: string, fileName: string): Promise<BlobResult> {
	const options: CreateBlobRequestOptions = {};
	return promisifyErrorOrResult<BlobResult>(cb => service.createBlockBlobFromLocalFile(name, blobName, fileName, options, cb));
}

export function createBlobFromText(blobName: string, text: string): Promise<BlobResult> {
	const options: CreateBlobRequestOptions = {};
	return promisifyErrorOrResult<BlobResult>(cb => service.createBlockBlobFromText(name, blobName, text, options, cb));
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

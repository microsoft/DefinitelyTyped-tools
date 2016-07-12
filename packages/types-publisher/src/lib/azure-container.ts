import { BlobResult, BlobService, ContainerResult, ContinuationToken, CreateBlobRequestOptions, CreateContainerOptions, ErrorOrResponse, ErrorOrResult, ListBlobsResult, createBlobService } from "azure-storage";

export default class Container {
	private service: BlobService;

	constructor(readonly name: string) {
		this.service = createBlobService();
	}

	ensureCreated(options: CreateContainerOptions): Promise<void> {
		return promisifyErrorOrResult<ContainerResult>(cb => this.service.createContainerIfNotExists(this.name, options, cb)).then(() => {});
	}

	createBlobFromFile(blobName: string, fileName: string): Promise<BlobResult> {
		const options: CreateBlobRequestOptions = {};
		return promisifyErrorOrResult<BlobResult>(cb => this.service.createBlockBlobFromLocalFile(this.name, blobName, fileName, options, cb));
	}

	createBlobFromText(blobName: string, text: string): Promise<BlobResult> {
		const options: CreateBlobRequestOptions = {};
		return promisifyErrorOrResult<BlobResult>(cb => this.service.createBlockBlobFromText(this.name, blobName, text, options, cb));
	}

	async listBlobs(prefix: string): Promise<BlobResult[]> {
		const once = (token: ContinuationToken | null) =>
			promisifyErrorOrResult<ListBlobsResult>(cb => this.service.listBlobsSegmentedWithPrefix(this.name, prefix, token, cb));

		const out: BlobResult[] = [];
		let token: ContinuationToken | null = null;
		do {
			const {entries, continuationToken} = await once(token);
			out.push(...entries);
			token = continuationToken;
		} while (token);

		return out;
	}

	deleteBlob(blobName: string): Promise<void> {
		return promisifyErrorOrResponse(cb => this.service.deleteBlob(this.name, blobName, cb));
	}

	urlOfBlob(blobName: string): string {
		return `https://${this.name}.blob.core.windows.net/${this.name}/${blobName}`;
	}
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

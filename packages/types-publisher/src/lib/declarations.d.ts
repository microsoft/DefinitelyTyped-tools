interface Array<T> {
	includes(value: T): boolean;
}

declare module "buffer-equals-constant" {
	function f(a: Buffer, b: Buffer): boolean;
	export = f;
}

declare module "fs-promise" {
	export function exists(path: string): Promise<boolean>;
	export function writeFile(path: string, content: string, options: { encoding: "utf8" }): Promise<void>;
	export function readFile(path: string, options: { encoding: "utf8" }): Promise<string>
	export function mkdirp(path: string): Promise<void>
	export function readdir(dirPath: string): Promise<string[]>
	export function unlink(path: string): Promise<void>
	export function stat(path: string): Promise<{ isDirectory(): boolean }>
}

declare module "azure-storage" {
	// Based on https://github.com/Azure/azure-storage-node/blob/master/typings/azure-storage/azure-storage.d.ts
	// Subset that works for ts@next

	export function createBlobService(storageAccount: string, storageAccessKey: string): BlobService

	export interface BlobService {
		createContainerIfNotExists(container: string, options: CreateContainerOptions, callback: ErrorOrResult<ContainerResult>): void;
		createBlockBlobFromLocalFile(container: string, blob: string, localFileName: string, options: CreateBlobRequestOptions, callback: ErrorOrResult<BlobResult>): void;
		createBlockBlobFromText(container: string, blob: string, text: string | Buffer, options: CreateBlobRequestOptions, callback: ErrorOrResult<BlobResult>): void;
		listBlobsSegmentedWithPrefix(container: string, prefix: string, currentToken: ContinuationToken, callback: ErrorOrResult<ListBlobsResult>): void;
		deleteBlob(container: string, blob: string, callback: ErrorOrResponse): void;

		createOrReplaceAppendBlob(container: string, blob: string, options: CreateBlobRequestOptions, callback: ErrorOrResponse): void;
		appendFromText(container: string, blob: string, text: string, options: CreateBlobRequestOptions, callback: ErrorOrResult<BlobResult>): void;

		setServiceProperties(serviceProperties: ServicePropertiesResult.ServiceProperties, callback: ErrorOrResponse): void;
	}

	namespace ServicePropertiesResult {
		export interface RetentionPolicy {
			Enabled: boolean;
			Days: number;
		}
		export interface MetricsProperties {
			Version: string;
			Enabled: boolean;
			IncludeAPIs: boolean;
			RetentionPolicy: RetentionPolicy;
		}
		export interface CorsRule {
			AllowedMethods: string[];
			AllowedOrigins: string[];
			AllowedHeaders: string[];
			ExposedHeaders: string[];
			MaxAgeInSeconds: number;
		}
		export interface LoggingProperties {
			Version: string;
			Delete: boolean;
			Read: boolean;
			Write: boolean;
			RetentionPolicy: RetentionPolicy;
		}
		export interface ServiceProperties {
			DefaultServiceVersion?: string;
			Logging?: LoggingProperties;
			HourMetrics?: MetricsProperties;
			MinuteMetrics?: MetricsProperties;
			Cors?: {
				CorsRule: CorsRule[];
			};
		}
		export function serialize(servicePropertiesJs: ServiceProperties): string;
		export function parse(servicePropertiesXml: any): ServiceProperties;
	}

	export interface ContinuationToken {
		nextMarker: string;
		targetLocation?: StorageLocation;
	}

	export enum StorageLocation {
		PRIMARY = 0,
		SECONDARY = 1,
	}

	export interface CreateContainerOptions /*extends RequestOptions*/ {
		metadata?: Map<string>;
		publicAccessLevel?: string;
	}

	export interface CreateBlobRequestOptions {
		parallelOperationThreadCount?: number;
		useTransactionalMD5?: boolean;
		blockIdPrefix?: string;
		metadata?: {[k: string]: string};
		storeBlobContentMD5?: boolean;
		transactionalContentMD5?: string;
		contentSettings?: {
			contentType?: string;
			contentEncoding?: string;
			contentLanguage?: string;
			cacheControl?: string;
			contentDisposition?: string;
			contentMD5?: string;
		};
	}

	interface ErrorOrResponse {
		(error: Error, response: ServiceResponse): void;
	}

	export interface ErrorOrResult<TResult> {
		(error: Error, result: TResult, response: ServiceResponse): void;
	}

	interface ServiceResponse {
		isSuccessful: boolean;
		statusCode: number;
		body?: string | Buffer;
		headers?: Map<string>;
		md5: string;
		error?: StorageError | Error;
	}

	interface StorageError extends Error {
		statusCode?: number;
		requestId?: string;
		code?: string;
	}

	interface Map<T> {
		[index: string]: T;
	}

	export interface ContainerResult {
		name: string;
		publicAccessLevel: string;
		etag: string;
		lastModified: string;
		metadata?: { [key: string]: string; };
		requestId?: string;
		lease?: {
		duration?: string;
		status: string;
		state: string;
		};
		exists?: boolean;
		created?: boolean;
	}

	export interface BlobResult {
		name: string;
		snapshot?: string;
		container: string;
		metadata?: { [key: string]: string; };
		etag: string;
		lastModified: string;
		contentLength: string;
		blobType: string;
		requestId: string;
		sequenceNumber?: string;
		contentRange?: string;
		committedBlockCount?: string;
		appendOffset?: string;
		contentSettings?: {
			contentType?: string;
			contentEncoding?: string;
			contentLanguage?: string;
			cacheControl?: string;
			contentDisposition?: string;
			contentMD5?: string;
		};
		lease?: {
			id?: string;
			status?: string;
			state?: string;
			duration?: string;
		};
		copy?: {
			id?: string;
			status?: string;
			completionTime?: string;
			statusDescription?: string;
			progress?: string;
			source?: string;
		};
		exists?: boolean;
		created?: boolean;
	}

	export interface ListBlobsResult {
		entries: BlobResult[];
		continuationToken?: ContinuationToken;
	}
}

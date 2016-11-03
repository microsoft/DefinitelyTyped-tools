// Definitions transcribed from https://github.com/npm/npm-registry-client
declare class RegClient {
	constructor(config: {});
	request(uri: string, params: RegClient.RequestParams, cb: (error: Error, data: any, json: any, response: any) => void): void;
	publish(uri: string, params: RegClient.PublishParams, cb: (error: Error) => void): void;
	tag(uri: string, params: RegClient.TagParams, cb: (error: Error) => void): void;
	deprecate(uri: string, params: RegClient.DeprecateParams, cb: (error: Error, data: any, raw: string, response: any) => void): void;
}

declare namespace RegClient {
	interface RequestParams {
		method?: string;
		body?: {};
	}
	interface PublishParams {
		metadata: {};
		access: "public" | "restricted";
		body: NodeJS.ReadableStream;
		auth: Credentials;
	}
	interface TagParams {
		version: string;
		tag: string;
		auth: Credentials;
	}
	interface DeprecateParams {
		version: string;
		message: string;
		auth: Credentials;
	}
	interface Credentials {
		token: string;
	}
}

export = RegClient;

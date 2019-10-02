// Definitions transcribed from https://github.com/npm/npm-registry-client
declare class RegClient {
    constructor(config?: RegClient.Config);
    request(uri: string, params: RegClient.RequestParams, cb: (error: Error, data: unknown, json: unknown, response: unknown) => void): void;
    publish(uri: string, params: RegClient.PublishParams, cb: (error: Error) => void): void;
    deprecate(uri: string, params: RegClient.DeprecateParams, cb: (error: Error, data: unknown, raw: string, response: unknown) => void): void;
    distTags: {
        add(uri: string, params: RegClient.AddTagParams, cb: (error: Error) => void): void;
    }
}

declare namespace RegClient {
    interface Config {
        defaultTag?: string;
    }
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
    interface AddTagParams {
        package: string;
        version: string;
        distTag: string;
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

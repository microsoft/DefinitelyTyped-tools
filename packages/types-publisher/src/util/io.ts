import {
    readFile as readFileWithEncoding,
    readFileSync as readFileWithEncodingSync,
    stat,
    writeFile as writeFileWithEncoding,
    writeJson as writeJsonRaw,
} from "fs-extra";
import { request as httpRequest } from "http";
import { Agent, request } from "https";
import { Readable as ReadableStream } from "stream";
import { StringDecoder } from "string_decoder";

import { parseJson } from "./util";

export async function readFile(path: string): Promise<string> {
    const res = await readFileWithEncoding(path, { encoding: "utf8" });
    if (res.includes("�")) {
        throw new Error(`Bad character in ${path}`);
    }
    return res;
}

export function readFileSync(path: string): string {
    const res = readFileWithEncodingSync(path, { encoding: "utf8" });
    if (res.includes("�")) {
        throw new Error(`Bad character in ${path}`);
    }
    return res;
}

export function readJsonSync(path: string): object {
    return parseJson(readFileSync(path));
}

export async function readJson(path: string): Promise<object> {
    return parseJson(await readFile(path));
}

export function writeFile(path: string, content: string): Promise<void> {
    return writeFileWithEncoding(path, content, { encoding: "utf8" });
}

export function writeJson(path: string, content: unknown, formatted = true): Promise<void> {
    return writeJsonRaw(path, content, { spaces: formatted ? 4 : 0 });
}

export function streamOfString(text: string): NodeJS.ReadableStream {
    const s = new ReadableStream();
    s.push(text);
    s.push(null); // tslint:disable-line no-null-keyword
    return s;
}

export function stringOfStream(stream: NodeJS.ReadableStream, description: string): Promise<string> {
    const decoder = new StringDecoder("utf8");
    let body = "";
    stream.on("data", (data: Buffer) => {
        body += decoder.write(data);
    });
    return new Promise<string>((resolve, reject) => {
        stream.on("error", reject);
        stream.on("end", () => {
            body += decoder.end();
            if (body.includes("�")) {
                reject(`Bad character decode in ${description}`);
            } else {
                resolve(body);
            }
        });
    });
}

export function streamDone(stream: NodeJS.WritableStream): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        stream.on("error", reject).on("finish", resolve);
    });
}

export interface FetchOptions {
    readonly hostname: string;
    readonly port?: number;
    readonly path: string;
    readonly retries?: boolean | number;
    readonly body?: string;
    readonly method?: "GET" | "PATCH" | "POST";
    readonly headers?: {};
}
export class Fetcher {
    private readonly agent = new Agent({ keepAlive: true });

    async fetchJson(options: FetchOptions): Promise<unknown> {
        const text = await this.fetch(options);
        try {
            return JSON.parse(text) as unknown;
        } catch (e) {
            throw new Error(`Bad response from server:\noptions: ${JSON.stringify(options)}\n\n${text}`);
        }
    }

    async fetch(options: FetchOptions): Promise<string> {
        const maxRetries = options.retries === false || options.retries === undefined ? 0 : options.retries === true ? 10 : options.retries;
        for (let retries = maxRetries; retries > 1; retries--) {
            try {
                return await doRequest(options, request, this.agent);
            } catch (err) {
                if (!/EAI_AGAIN|ETIMEDOUT|ECONNRESET/.test((err as Error).message)) {
                    throw err;
                }
            }
            await sleep(1);
        }
        return doRequest(options, request, this.agent);
    }
}

/** Only used for testing. */
export function makeHttpRequest(options: FetchOptions): Promise<string> {
    return doRequest(options, httpRequest);
}

function doRequest(options: FetchOptions, makeRequest: typeof request, agent?: Agent): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = makeRequest(
            {
                hostname: options.hostname,
                port: options.port,
                path: `/${options.path}`,
                agent,
                method: options.method || "GET",
                headers: options.headers,
            },
            res => {
                let text = "";
                res.on("data", (d: string) => { text += d; });
                res.on("error", reject);
                res.on("end", () => { resolve(text); });
            });
        if (options.body !== undefined) {
            req.write(options.body);
        }
        req.end();
    });
}

export async function sleep(seconds: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));
}

export async function isDirectory(path: string): Promise<boolean> {
    return (await stat(path)).isDirectory();
}

export const npmInstallFlags = "--ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links --no-save";

import assert = require("assert");
import { readdir, readFile as readFileWithEncoding, stat, writeFile as writeFileWithEncoding, writeJson as writeJsonRaw } from "fs-extra";
import { Agent, request } from "https";
import { join as joinPaths } from "path";
import * as stream from "stream";

import { parseJson } from "./util";

export function readFile(path: string): Promise<string> {
	return readFileWithEncoding(path, { encoding: "utf8" });
}

export async function readJson(path: string): Promise<any> {
	return parseJson(await readFile(path));
}

export function writeFile(path: string, content: string): Promise<void> {
	return writeFileWithEncoding(path, content, { encoding: "utf8" });
}

export function writeJson(path: string, content: any, formatted = true): Promise<void> {
	return writeJsonRaw(path, content, { spaces: formatted ? 4 : 0 });
}

export function streamOfString(text: string): NodeJS.ReadableStream {
	const s = new stream.Readable();
	s.push(text);
	s.push(null); // tslint:disable-line no-null-keyword
	return s;
}

export function stringOfStream(stream: NodeJS.ReadableStream): Promise<string> {
	let body = "";
	stream.on("data", (data: Buffer) => {
		body += data.toString("utf8");
	});
	return new Promise<string>((resolve, reject) => {
		stream.on("error", reject);
		stream.on("end", () => { resolve(body); });
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
	readonly retries?: true | number;
	readonly body?: string;
	readonly method?: "GET" | "PATCH" | "POST";
	readonly headers?: {};
}
export class Fetcher {
	private readonly agent = new Agent({ keepAlive: true });

	async fetchJson(options: FetchOptions): Promise<{}> {
		const text = await this.fetch(options);
		try {
			return JSON.parse(text);
		} catch (e) {
			throw new Error(`Bad response from server:\n${text}`);
		}
	}

	async fetch(options: FetchOptions): Promise<string> {
		const maxRetries = options.retries === false || options.retries === undefined ? 0 : options.retries === true ? 10 : options.retries;
		for (let retries = maxRetries; retries > 1; retries--) {
			try {
				return await this.fetchOnce(options);
			} catch (err) {
				if (!/EAI_AGAIN|ETIMEDOUT|ECONNRESET/.test(err.message)) {
					throw err;
				}
			}
			await sleep(1);
		}
		return this.fetchOnce(options);
	}

	private fetchOnce(options: FetchOptions): Promise<string> {
		return new Promise((resolve, reject) => {
			const req = request(
				{
					hostname: options.hostname,
					port: options.port,
					path: `/${options.path}`,
					agent: this.agent,
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
}

export async function sleep(seconds: number): Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, seconds * 1000));
}

export async function isDirectory(path: string): Promise<boolean> {
	return (await stat(path)).isDirectory();
}

export async function assertDirectoriesEqual(expected: string, actual: string, options: { ignore(fileName: string): boolean }): Promise<void> {
	const expectedLs = await readdir(expected);
	const actualLs = await readdir(actual);
	assert.deepEqual(expectedLs, actualLs);
	for (const name of expectedLs) {
		if (options.ignore(name)) {
			continue;
		}

		const expectedFile = joinPaths(expected, name);
		const actualFile = joinPaths(actual, name);
		const expectedStat = await stat(expectedFile);
		const actualStat = await stat(actualFile);
		assert.equal(expectedStat.isDirectory(), actualStat.isDirectory());
		if (expectedStat.isDirectory()) {
			await assertDirectoriesEqual(expectedFile, actualFile, options);
		} else {
			assert.equal(await readFile(actualFile), await readFile(expectedFile));
		}
	}
}

export const npmInstallFlags = "--ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links --no-save";

import assert = require("assert");
import { readdir, readFile as readFileWithEncoding, stat, writeFile as writeFileWithEncoding, writeJson as writeJsonRaw } from "fs-extra";
import fetch, { RequestInit, Response } from "node-fetch";
import { join as joinPaths } from "path";
import * as stream from "stream";

import { parseJson } from "./util";

export function readFile(path: string): Promise<string> {
	return readFileWithEncoding(path, { encoding: "utf8" });
}

export async function readJson(path: string): Promise<any> {
	return parseJson(await readFile(path));
}

export async function fetchJson(url: string, init?: RequestInit & { retries?: number | true }): Promise<{}> {
	// Cast needed: https://github.com/Microsoft/TypeScript/issues/10065
	const response = await (init && init.retries ? fetchWithRetries(url, init as RequestInit & { retries: number | true }) : fetch(url, init));
	return parseJson(await response.text());
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

async function fetchWithRetries(url: string, init: RequestInit & { retries: number | true }): Promise<Response> {
	const maxRetries = init.retries === true ? 10 : init.retries;
	for (let retries = maxRetries; retries > 1; retries--) {
		try {
			return await fetch(url, init);
		} catch (err) {
			if (!/EAI_AGAIN|ETIMEDOUT|ECONNRESET/.test(err.message)) {
				throw err;
			}
		}
		await sleep(1);
	}
	return fetch(url, init);
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

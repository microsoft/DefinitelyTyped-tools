import assert = require("assert");
import fetch, { RequestInit, Response } from "node-fetch";
import * as path from "path";
import recursiveReaddir = require("recursive-readdir");
import { Stats } from "fs";
import * as fsp from "fs-promise";
import * as stream from "stream";

import { normalizeSlashes, parseJson } from "./util";

export function readdirRecursive(dirPath: string, keepIf: (file: string, stats: Stats) => boolean): Promise<string[]> {
	function relativePath(file: string): string {
		const prefix = dirPath + path.sep;
		assert(file.startsWith(prefix));
		return normalizeSlashes(file.slice(prefix.length));
	}
	function ignoreRelative(file: string, stats: Stats): boolean {
		return !keepIf(relativePath(file), stats);
	}

	return new Promise<string[]>((resolve, reject) => {
		recursiveReaddir(dirPath, [ignoreRelative], (err, files) => {
			if (err) {
				reject(err);
			}
			else {
				resolve(files.map(relativePath));
			}
		});
	});
}

export function readFile(path: string): Promise<string> {
	return fsp.readFile(path, { encoding: "utf8" });
}

export async function readJson(path: string): Promise<any> {
	return parseJson(await readFile(path));
}

export async function fetchJson(url: string, init?: RequestInit & { retries?: number | true }): Promise<any> {
	// Cast needed: https://github.com/Microsoft/TypeScript/issues/10065
	const response = await (init && init.retries ? fetchWithRetries(url, init as RequestInit & { retries: number | true }) : fetch(url, init));
	return parseJson(await response.text());
}

export function writeFile(path: string, content: string): Promise<void> {
	return fsp.writeFile(path, content, { encoding: "utf8" });
}

export function writeJson(path: string, content: any, formatted = true): Promise<void> {
	return writeFile(path, JSON.stringify(content, undefined, formatted ? 4 : undefined));
}

export function streamOfString(text: string): NodeJS.ReadableStream {
	const s = new stream.Readable();
	s.push(text);
	s.push(null);
	return s;
}

export function stringOfStream(stream: NodeJS.ReadableStream): Promise<string> {
	let body = "";
	stream.on("data", (data: Buffer) => {
		body += data.toString("utf8");
	});
	return new Promise((resolve, reject) => {
		stream.on("error", reject);
		stream.on("end", () => resolve(body));
	});
}

export function streamDone(stream: NodeJS.WritableStream): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		stream.on("error", reject).on("finish", resolve);
	});
}

async function fetchWithRetries(url: string, init: RequestInit & { retries: number | true }): Promise<Response> {
	for (let retries = init.retries === true ? 5 : init.retries; retries > 1; retries--) {
		try {
			return await fetch(url, init);
		} catch (err) {
			if (!/ETIMEDOUT|ECONNRESET/.test(err.message)) {
				throw err;
			}
		}
	}
	return await fetch(url);
}

import assert = require("assert");
import fetch = require("node-fetch");
import moment = require("moment");
import * as path from "path";
import recursiveReaddir = require("recursive-readdir");
import { Stats } from "fs";
import * as fsp from "fs-promise";
import * as stream from "stream";
import * as zlib from "zlib";

export function parseJson(text: string): any {
	try {
		return JSON.parse(text);
	}
	catch (err) {
		throw new Error(`${err.message} due to JSON: ${text}`);
	}
}

export function currentTimeStamp(): string {
	return moment().format("YYYY-MM-DDTHH:mm:ss.SSSZZ");
}

export async function nAtATime<T, U>(n: number, inputs: T[], use: (t: T) => Promise<U>): Promise<U[]> {
	const results = new Array(inputs.length);
	// We have n "threads" which each run `continuouslyWork`.
	// They all share `nextIndex`, so each work item is done only once.
	let nextIndex = 0;
	await Promise.all(initArray(n, async () => {
		while (nextIndex !== inputs.length) {
			const index = nextIndex;
			nextIndex++;
			results[index] = await use(inputs[index]);
		}
	}));
	return results;
}

export async function filterAsyncOrdered<T>(arr: T[], shouldKeep: (t: T) => Promise<boolean>): Promise<T[]> {
	const shouldKeeps: boolean[] = await Promise.all(arr.map(shouldKeep));
	return arr.filter((_, idx) => shouldKeeps[idx]);
}

export async function mapAsyncOrdered<T, U>(arr: T[], mapper: (t: T) => Promise<U>): Promise<U[]> {
	const out = new Array(arr.length);
	await Promise.all(arr.map(async (em, idx) => {
		out[idx] = await mapper(em);
	}));
	return out;
}

export function readdirRecursive(dirPath: string, keepIf: (file: string, stats: Stats) => boolean): Promise<string[]> {
	function relativePath(file: string): string {
		const prefix = dirPath + path.sep;
		assert(file.startsWith(prefix));
		return file.slice(prefix.length);
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

export function indent(str: string): string {
	return "\t" + str.replace(/\n/g, "\n\t");
}

export function stripQuotes(s: string): string {
	if (s[0] === '"' || s[0] === "'") {
		return s.substr(1, s.length - 2);
	} else {
		throw new Error(`${s} is not quoted`);
	}
}

export function unique<T>(arr: T[]) {
	return [...new Set(arr)];
}

export function readFile(path: string): Promise<string> {
	return fsp.readFile(path, { encoding: "utf8" });
}

export async function readJson(path: string): Promise<any> {
	return parseJson(await readFile(path));
}

export async function fetchJson(url: string, init?: _fetch.RequestInit): Promise<any> {
	const response = await fetch(url, init);
	const text = await response.text();
	return parseJson(text);
}

export function writeFile(path: string, content: string): Promise<void> {
	return fsp.writeFile(path, content, { encoding: "utf8" });
}

export function writeJson(path: string, content: any): Promise<void> {
	return writeFile(path, JSON.stringify(content, undefined, 4));
}

export function done(promise: Promise<void>): void {
	promise.catch(console.error);
}

export function gzip(input: NodeJS.ReadableStream): NodeJS.ReadableStream {
	return input.pipe(zlib.createGzip());
}

export function unGzip(input: NodeJS.ReadableStream): NodeJS.ReadableStream {
	const output = zlib.createGunzip();
	input.pipe(output);
	return output;
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

function initArray<T>(length: number, makeElement: () => T): T[] {
	const arr = new Array(length);
	for (let i = 0; i < length; i++) {
		arr[i] = makeElement();
	}
	return arr;
}

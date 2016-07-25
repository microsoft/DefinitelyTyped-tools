import assert = require("assert");
import fetch = require("node-fetch");
import moment = require("moment");
import recursiveReaddir = require("recursive-readdir");
import { Stats } from "fs";
import * as fsp from "fs-promise";

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

export async function nAtATime<T, U>(n: number, input: T[], use: (t: T) => Promise<U>): Promise<U[]> {
	let res: U[] = [];
	for (let i = 0; i < input.length; i += n) {
		const thisInputs = input.slice(i, i + n);
		const thisBatch = await Promise.all(thisInputs.map(use));
		res.push(...thisBatch);
	}
	return res;
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
		const prefix = `${dirPath}\\`;
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

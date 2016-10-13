import assert = require("assert");
import fetch = require("node-fetch");
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

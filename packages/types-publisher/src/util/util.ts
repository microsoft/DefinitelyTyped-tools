import * as child_process from "child_process";
import * as crypto from "crypto";
import moment = require("moment");
import * as os from "os";
import { shim as shimEntries } from "object.entries";
shimEntries();
import { shim as shimValues } from "object.values";
shimValues();
import { inspect } from "util";

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

export const numberOfOsProcesses = os.cpus().length;

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

export function done(promise: Promise<void>): void {
	promise.catch(error => {
		console.error(error);
		process.exit(1);
	});
}

function initArray<T>(length: number, makeElement: () => T): T[] {
	const arr = new Array(length);
	for (let i = 0; i < length; i++) {
		arr[i] = makeElement();
	}
	return arr;
}

export function normalizeSlashes(path: string): string {
	return path.replace(/\\/g, "/");
}

export function hasOwnProperty(object: {}, propertyName: string): boolean {
	return Object.prototype.hasOwnProperty.call(object, propertyName);
}

export function intOfString(str: string) {
	const n = Number.parseInt(str, 10);
	if (Number.isNaN(n)) {
		throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
	}
	return n;
}

export function sortObjectKeys<T extends { [key: string]: any }>(data: T): T {
	const out = {} as T;
	for (const key of Object.keys(data).sort()) {
		out[key] = data[key];
	}
	return out;
}

/** Run a command and return the error, stdout, and stderr. (Never throws.) */
export function exec(cmd: string, cwd?: string): Promise<{ error?: Error, stdout: string, stderr: string }> {
	return new Promise((resolve) => {
		child_process.exec(cmd, { encoding: "utf8", cwd }, (error, stdout, stderr) => {
			stdout = stdout.trim();
			stderr = stderr.trim();
			resolve({ error, stdout, stderr });
		});
	});
}

/** Run a command and return the stdout, or if there was an error, throw. */
export async function execAndThrowErrors(cmd: string, cwd?: string): Promise<string> {
	const { error, stdout, stderr } = await exec(cmd, cwd);
	if (error) {
		throw new Error(stderr);
	}
	return stdout + stderr;
}

export function errorDetails(error: Error): string {
	return error.stack || error.message || `Non-Error error: ${inspect(error)}`;
}

/**
 * Returns the input that is better than all others, or `undefined` if there are no inputs.
 * @param isBetter Returns true if `a` should be preferred over `b`.
 */
export function best<T>(inputs: T[], isBetter: (a: T, b: T) => boolean): T | undefined {
	if (!inputs.length) {
		return undefined;
	}

	let best = inputs[0];
	for (let i = 1; i < inputs.length; i++) {
		const candidate = inputs[i];
		if (isBetter(candidate, best)) {
			best = candidate;
		}
	}
	return best;
}

export function computeHash(content: string): string {
	// Normalize line endings
	content = content.replace(/\r\n?/g, "\n");

	const h = crypto.createHash("sha256");
	h.update(content, "utf8");
	return <string> h.digest("hex");
}

export function mapValues<K, V1, V2>(map: Map<K, V1>, valueMapper: (value: V1) => V2): Map<V1, V2> {
	const out = new Map();
	map.forEach((value, key) => {
		out.set(key, valueMapper(value));
	});
	return out;
}

import moment = require("moment");

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
	promise.catch(console.error);
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

import assert = require("assert");
import { ChildProcess, exec as node_exec, fork } from "child_process";
import * as crypto from "crypto";
import moment = require("moment");
import * as os from "os";
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install();
import { inspect } from "util";

if (!Object.entries) {
	Object.entries = (obj: any) =>
		Object.getOwnPropertyNames(obj).map(key => [key, obj[key]] as [string, unknown]);
}

export function assertDefined<T>(x: T | undefined): T {
	assert(x !== undefined);
	return x!;
}

import { Options } from "../lib/common";
import ProgressBar from "./progress";

export function parseJson(text: string): object {
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new Error(`${err.message} due to JSON: ${text}`);
	}
}

export function currentTimeStamp(): string {
	return moment().format("YYYY-MM-DDTHH:mm:ss.SSSZZ");
}

export const numberOfOsProcesses = process.env.TRAVIS === "true" ? 2 : os.cpus().length;

/** Progress options needed for `nAtATime`. Other options will be inferred. */
interface ProgressOptions<T, U> {
	readonly name: string;
	flavor(input: T, output: U): string | undefined;
	readonly options: Options;
}

export async function nAtATime<T, U>(
	n: number,
	inputs: ReadonlyArray<T>,
	use: (t: T) => Awaitable<U>,
	progressOptions?: ProgressOptions<T, U>): Promise<U[]> {
	const progress = progressOptions && progressOptions.options.progress ? new ProgressBar({ name: progressOptions.name }) : undefined;

	const results = new Array(inputs.length);
	// We have n "threads" which each run `continuouslyWork`.
	// They all share `nextIndex`, so each work item is done only once.
	let nextIndex = 0;
	await Promise.all(initArray(n, async () => {
		while (nextIndex !== inputs.length) {
			const index = nextIndex;
			nextIndex++;
			const input = inputs[index];
			const output = await use(input);
			results[index] = output;
			if (progress) {
				progress!.update(index / inputs.length, progressOptions!.flavor(input, output));
			}
		}
	}));
	if (progress) {
		progress.done();
	}
	return results;
}

export function filter<T>(iterable: Iterable<T>, predicate: (value: T) => boolean): IterableIterator<T> {
	const iter = iterable[Symbol.iterator]();
	return {
		[Symbol.iterator](): IterableIterator<T> { return this; },
		next(): IteratorResult<T> {
			while (true) {
				const res = iter.next();
				if (res.done || predicate(res.value)) {
					return res;
				}
			}
		}
	};
}

export type Awaitable<T> = T | Promise<T>;

export async function filterNAtATime<T>(
	n: number, inputs: ReadonlyArray<T>, shouldKeep: (input: T) => Awaitable<boolean>, progress?: ProgressOptions<T, boolean>): Promise<T[]> {
	const shouldKeeps: boolean[] = await nAtATime(n, inputs, shouldKeep, progress);
	return inputs.filter((_, idx) => shouldKeeps[idx]);
}

export async function mapAsyncOrdered<T, U>(arr: ReadonlyArray<T>, mapper: (t: T) => Promise<U>): Promise<U[]> {
	const out = new Array(arr.length);
	await Promise.all(arr.map(async (em, idx) => {
		out[idx] = await mapper(em);
	}));
	return out;
}

export function indent(str: string): string {
	return `\t${str.replace(/\n/g, "\n\t")}`;
}

export function unique<T>(arr: ReadonlyArray<T>): T[] {
	return [...new Set(arr)];
}

export function done(promise: Promise<unknown> | (() => Promise<unknown>)): void {
	(typeof promise === "function" ? promise() : promise).catch(error => {
		console.error(error);
		process.exit(1);
	});
}

function initArray<T>(length: number, makeElement: (i: number) => T): T[] {
	const arr = new Array(length);
	for (let i = 0; i < length; i++) {
		arr[i] = makeElement(i);
	}
	return arr;
}

/** Always use "/" for consistency. (This affects package content hash.) */
export function joinPaths(...paths: string[]): string {
	return paths.join("/");
}

/** Convert a path to use "/" instead of "\\" for consistency. (This affects content hash.) */
export function normalizeSlashes(path: string): string {
	return path.replace(/\\/g, "/");
}

export function hasWindowsSlashes(path: string): boolean {
	return path.includes("\\");
}

export function hasOwnProperty(object: {}, propertyName: string): boolean {
	return Object.prototype.hasOwnProperty.call(object, propertyName);
}

export function intOfString(str: string): number {
	const n = Number.parseInt(str, 10);
	if (Number.isNaN(n)) {
		throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
	}
	return n;
}

export function sortObjectKeys<T extends { [key: string]: unknown }>(data: T): T {
	const out = {} as T; // tslint:disable-line no-object-literal-type-assertion
	for (const key of Object.keys(data).sort()) {
		out[key] = data[key];
	}
	return out;
}

/** Run a command and return the error, stdout, and stderr. (Never throws.) */
export function exec(cmd: string, cwd?: string): Promise<{ error: Error | undefined, stdout: string, stderr: string }> {
	return new Promise<{ error: Error | undefined, stdout: string, stderr: string }>(resolve => {
		// Fix "stdout maxBuffer exceeded" error
		// See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/26545#issuecomment-402274021
		const maxBuffer = 1024 * 1024 * 1; // Max = 1 MiB, default is 200 KiB

		node_exec(cmd, { encoding: "utf8", cwd, maxBuffer }, (error, stdout, stderr) => {
			resolve({ error: error === null ? undefined : error, stdout: stdout.trim(), stderr: stderr.trim() });
		});
	});
}

/** Run a command and return the stdout, or if there was an error, throw. */
export async function execAndThrowErrors(cmd: string, cwd?: string): Promise<string> {
	const { error, stdout, stderr } = await exec(cmd, cwd);
	if (error) {
		throw new Error(`${error.stack}\n${stderr}`);
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
export function best<T>(inputs: Iterable<T>, isBetter: (a: T, b: T) => boolean): T | undefined {
	const iter = inputs[Symbol.iterator]();

	const first = iter.next();
	if (first.done) {
		return undefined;
	}
	let best = first.value;

	while (true) {
		const { value, done } = iter.next();
		if (done) {
			break;
		}
		if (isBetter(value, best)) {
			best = value;
		}
	}
	return best;
}

export function computeHash(content: string): string {
	// Normalize line endings
	const normalContent = content.replace(/\r\n?/g, "\n");

	const h = crypto.createHash("sha256");
	h.update(normalContent, "utf8");
	return h.digest("hex");
}

export function mapValues<K, V1, V2>(map: Map<K, V1>, valueMapper: (value: V1) => V2): Map<K, V2> {
	const out = new Map<K, V2>();
	map.forEach((value, key) => {
		out.set(key, valueMapper(value));
	});
	return out;
}

export function multiMapAdd<K, V>(map: Map<K, V[]>, key: K, value: V): void {
	const values = map.get(key);
	if (values) {
		values.push(value);
	} else {
		map.set(key, [value]);
	}
}

export function* concat<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
	yield* a;
	yield* b;
}

export function mapDefined<T, U>(arr: Iterable<T>, mapper: (t: T) => U | undefined): U[] {
	const out = [];
	for (const a of arr) {
		const res = mapper(a);
		if (res !== undefined) {
			out.push(res);
		}
	}
	return out;
}

export function* map<T, U>(inputs: Iterable<T>, mapper: (t: T) => U): Iterable<U> {
	for (const input of inputs) {
		yield mapper(input);
	}
}

export function* flatMap<T, U>(inputs: Iterable<T>, mapper: (t: T) => Iterable<U>): Iterable<U> {
	for (const input of inputs) {
		yield* mapper(input);
	}
}

export function some<T>(iter: IterableIterator<T>, cb: (t: T) => boolean): boolean {
	for (const x of iter) {
		if (cb(x)) {
			return true;
		}
	}
	return false;
}

export function sort<T>(values: Iterable<T>, comparer?: (a: T, b: T) => number): T[] {
	return Array.from(values).sort(comparer);
}

export function join<T>(values: Iterable<T>, joiner = ", "): string {
	let s = "";
	for (const v of values) {
		s += `${v}${joiner}`;
	}
	return s.slice(0, s.length - joiner.length);
}

export interface RunWithChildProcessesOptions<In> {
	readonly inputs: ReadonlyArray<In>;
	readonly commandLineArgs: string[];
	readonly workerFile: string;
	readonly nProcesses: number;
	handleOutput(output: {}): void;
}
export function runWithChildProcesses<In>(
	{ inputs, commandLineArgs, workerFile, nProcesses, handleOutput }: RunWithChildProcessesOptions<In>,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const nPerProcess = Math.floor(inputs.length / nProcesses);
		let processesLeft = nProcesses;
		let rejected = false;
		const allChildren: ChildProcess[] = [];
		for (let i = 0; i < nProcesses; i++) {
			const lo = nPerProcess * i;
			const hi = i === nProcesses - 1 ? inputs.length : lo + nPerProcess;
			let outputsLeft = hi - lo; // Expect one output per input
			if (outputsLeft === 0) {
				// No work for this process to do, so don't launch it
				processesLeft--;
				continue;
			}
			const child = fork(workerFile, commandLineArgs);
			allChildren.push(child);
			child.send(inputs.slice(lo, hi));
			child.on("message", outputMessage => {
				handleOutput(outputMessage);
				assert(outputsLeft > 0);
				outputsLeft--;
				if (outputsLeft === 0) {
					assert(processesLeft > 0);
					processesLeft--;
					if (processesLeft === 0) {
						resolve();
					}
					child.kill();
				}
			});
			child.on("disconnect", () => {
				if (outputsLeft !== 0) {
					fail();
				}
			});
			child.on("close", () => { assert(rejected || outputsLeft === 0); });
			child.on("error", fail);
		}

		function fail(): void {
			rejected = true;
			for (const child of allChildren) {
				child.kill();
			}
			reject(new Error("Parsing failed."));
		}
	});
}

interface RunWithListeningChildProcessesOptions<In> {
	readonly inputs: ReadonlyArray<In>;
	readonly commandLineArgs: string[];
	readonly workerFile: string;
	readonly nProcesses: number;
	readonly cwd: string;
	handleOutput(output: {}): void;
}
export function runWithListeningChildProcesses<In>(
	{ inputs, commandLineArgs, workerFile, nProcesses, cwd, handleOutput }: RunWithListeningChildProcessesOptions<In>,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let inputIndex = 0;
		let processesLeft = nProcesses;
		let rejected = false;
		const allChildren: ChildProcess[] = [];
		for (let i = 0; i < nProcesses; i++) {
			if (inputIndex === inputs.length) {
				processesLeft--;
				continue;
			}

			const child = fork(workerFile, commandLineArgs, { cwd });
			allChildren.push(child);
			child.send(inputs[inputIndex]);
			inputIndex++;

			child.on("message", outputMessage => {
				handleOutput(outputMessage);
				if (inputIndex === inputs.length) {
					processesLeft--;
					if (processesLeft === 0) {
						resolve();
					}
					child.kill();
				} else {
					child.send(inputs[inputIndex]);
					inputIndex++;
				}
			});
			child.on("disconnect", () => {
				if (inputIndex !== inputs.length) {
					fail();
				}
			});
			child.on("close", () => { assert(rejected || inputIndex === inputs.length); });
			child.on("error", fail);
		}

		function fail(): void {
			rejected = true;
			for (const child of allChildren) {
				child.kill();
			}
			reject(new Error(`Something went wrong in ${runWithListeningChildProcesses.name}`));
		}
	});
}

export function assertNever(_: never): never {
	throw new Error();
}

export function recordToMap<T>(record: Record<string, T>): Map<string, T>;
export function recordToMap<T, U>(record: Record<string, T>, cb: (t: T) => U): Map<string, U>;
export function recordToMap<T, U>(record: Record<string, T>, cb?: (t: T) => U): Map<string, T | U> {
	const m = new Map<string, T | U>();
	for (const key in record) {
		m.set(key, cb ? cb(record[key]) : record[key]);
	}
	return m;
}

export function mapToRecord<T>(map: Map<string, T>): Record<string, T>;
export function mapToRecord<T, U>(map: Map<string, T>, cb: (t: T) => U): Record<string, U>;
export function mapToRecord<T, U>(map: Map<string, T>, cb?: (t: T) => U): Record<string, T | U> {
	const o: Record<string, T | U> = {};
	map.forEach((value, key) => { o[key] = cb ? cb(value) : value; });
	return o;
}

export function identity<T>(t: T): T { return t; }

export function withoutStart(s: string, start: string): string | undefined {
	return s.startsWith(start) ? s.slice(start.length) : undefined;
}

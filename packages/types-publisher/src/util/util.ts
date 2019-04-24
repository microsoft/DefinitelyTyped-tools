import assert = require("assert");
import { ChildProcess, exec as node_exec, fork } from "child_process";
import * as crypto from "crypto";
import moment = require("moment");
import * as os from "os";
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install();

export function assertDefined<T>(x: T | undefined, message?: string | Error | undefined): T {
    assert(x !== undefined, message);
    return x!;
}

import { Options } from "../lib/common";
import ProgressBar from "./progress";

const DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE = 4096;

export function parseJson(text: string): object {
    try {
        return JSON.parse(text) as object;
    } catch (err) {
        throw new Error(`${(err as Error).message} due to JSON: ${text}`);
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
        },
    };
}

export type Awaitable<T> = T | Promise<T>;

export async function filterNAtATimeOrdered<T>(
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

export function unique<T>(arr: Iterable<T>): T[] {
    return [...new Set(arr)];
}

export function logUncaughtErrors(promise: Promise<unknown> | (() => Promise<unknown>)): void {
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
        out[key as keyof T] = data[key as keyof T];
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

    let res = first.value;
    while (true) {
        const { value, done } = iter.next();
        if (done) {
            break;
        }
        if (isBetter(value, res)) {
            res = value;
        }
    }
    return res;
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

export async function mapDefinedAsync<T, U>(arr: Iterable<T>, mapper: (t: T) => Promise<U | undefined>): Promise<U[]> {
    const out = [];
    for (const a of arr) {
        const res = await mapper(a);
        if (res !== undefined) {
            out.push(res);
        }
    }
    return out;
}

export function* mapIter<T, U>(inputs: Iterable<T>, mapper: (t: T) => U): Iterable<U> {
    for (const input of inputs) {
        yield mapper(input);
    }
}

export function* flatMap<T, U>(inputs: Iterable<T>, mapper: (t: T) => Iterable<U>): Iterable<U> {
    for (const input of inputs) {
        yield* mapper(input);
    }
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
    handleOutput(output: unknown): void;
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
                handleOutput(outputMessage as unknown);
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

export const enum CrashRecoveryState {
    Normal,
    Retry,
    RetryWithMoreMemory,
    Crashed,
}

interface RunWithListeningChildProcessesOptions<In> {
    readonly inputs: ReadonlyArray<In>;
    readonly commandLineArgs: string[];
    readonly workerFile: string;
    readonly nProcesses: number;
    readonly cwd: string;
    readonly crashRecovery?: boolean;
    readonly crashRecoveryMaxOldSpaceSize?: number;
    handleOutput(output: unknown, processIndex: number | undefined): void;
    handleStart?(input: In, processIndex: number | undefined): void;
    handleCrash?(input: In, state: CrashRecoveryState, processIndex: number | undefined): void;
}
export function runWithListeningChildProcesses<In>(
    { inputs, commandLineArgs, workerFile, nProcesses, cwd, handleOutput, crashRecovery,
      crashRecoveryMaxOldSpaceSize = DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE,
      handleStart, handleCrash }: RunWithListeningChildProcessesOptions<In>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        let inputIndex = 0;
        let processesLeft = nProcesses;
        let rejected = false;
        const runningChildren = new Set<ChildProcess>();
        const maxOldSpaceSize = getMaxOldSpaceSize(process.execArgv) || 0;
        for (let i = 0; i < nProcesses; i++) {
            if (inputIndex === inputs.length) {
                processesLeft--;
                continue;
            }

            const processIndex = nProcesses > 1 ? i + 1 : undefined;
            let child: ChildProcess;
            let crashRecoveryState = CrashRecoveryState.Normal;
            let currentInput: In;

            const onMessage = (outputMessage: unknown) => {
                try {
                    const oldCrashRecoveryState = crashRecoveryState;
                    crashRecoveryState = CrashRecoveryState.Normal;
                    handleOutput(outputMessage as {}, processIndex);
                    if (inputIndex === inputs.length) {
                        stopChild(/*done*/ true);
                    } else {
                        if (oldCrashRecoveryState !== CrashRecoveryState.Normal) {
                            // retry attempt succeeded, restart the child for further tests.
                            console.log(`${processIndex}> Restarting...`);
                            restartChild(nextTask, process.execArgv);
                        } else {
                            nextTask();
                        }
                    }
                } catch (e) {
                    onError(e);
                }
            };

            const onClose = () => {
                if (rejected || !runningChildren.has(child)) {
                    return;
                }

                try {
                    // treat any unhandled closures of the child as a crash
                    if (crashRecovery) {
                        switch (crashRecoveryState) {
                            case CrashRecoveryState.Normal:
                                crashRecoveryState = CrashRecoveryState.Retry;
                                break;
                            case CrashRecoveryState.Retry:
                                // skip crash recovery if we're already passing a value for --max_old_space_size that
                                // is >= crashRecoveryMaxOldSpaceSize
                                crashRecoveryState = maxOldSpaceSize < crashRecoveryMaxOldSpaceSize
                                    ? CrashRecoveryState.RetryWithMoreMemory
                                    : crashRecoveryState = CrashRecoveryState.Crashed;
                                break;
                            default:
                                crashRecoveryState = CrashRecoveryState.Crashed;
                        }
                    } else {
                        crashRecoveryState = CrashRecoveryState.Crashed;
                    }

                    if (handleCrash) {
                        handleCrash(currentInput, crashRecoveryState, processIndex);
                    }

                    switch (crashRecoveryState) {
                        case CrashRecoveryState.Retry:
                            restartChild(resumeTask, process.execArgv);
                            break;
                        case CrashRecoveryState.RetryWithMoreMemory:
                            restartChild(resumeTask, [
                                ...getExecArgvWithoutMaxOldSpaceSize(),
                                `--max_old_space_size=${crashRecoveryMaxOldSpaceSize}`,
                            ]);
                            break;
                        case CrashRecoveryState.Crashed:
                            crashRecoveryState = CrashRecoveryState.Normal;
                            if (inputIndex === inputs.length) {
                                stopChild(/*done*/ true);
                            } else {
                                restartChild(nextTask, process.execArgv);
                            }
                            break;
                        default:
                            assert.fail(`${processIndex}> Unexpected crashRecoveryState: ${crashRecoveryState}`);
                    }
                } catch (e) {
                    onError(e);
                }
            };

            const onError = (err?: Error) => {
                child.removeAllListeners();
                runningChildren.delete(child);
                fail(err);
            };

            const startChild = (taskAction: () => void, execArgv: string[]) => {
                try {
                    child = fork(workerFile, commandLineArgs, { cwd, execArgv });
                    runningChildren.add(child);
                } catch (e) {
                    fail(e);
                    return;
                }

                try {
                    let closed = false;
                    const thisChild = child;
                    const onChildClosed = () => {
                        // Don't invoke `onClose` more than once for a single child.
                        if (!closed && child === thisChild) {
                            closed = true;
                            onClose();
                        }
                    };
                    const onChildDisconnectedOrExited = () => {
                        if (!closed && thisChild === child) {
                            // Invoke `onClose` after enough time has elapsed to allow `close` to be triggered.
                            // This is to ensure our `onClose` logic gets called in some conditions
                            const timeout = 1000;
                            setTimeout(onChildClosed, timeout);
                        }
                    };
                    child.on("message", onMessage);
                    child.on("close", onChildClosed);
                    child.on("disconnect", onChildDisconnectedOrExited);
                    child.on("exit", onChildDisconnectedOrExited);
                    child.on("error", onError);
                    taskAction();
                } catch (e) {
                    onError(e);
                }
            };

            const stopChild = (done: boolean) => {
                try {
                    assert(runningChildren.has(child), `${processIndex}> Child not running`);
                    if (done) {
                        processesLeft--;
                        if (processesLeft === 0) {
                            resolve();
                        }
                    }
                    runningChildren.delete(child);
                    child.removeAllListeners();
                    child.kill();
                } catch (e) {
                    onError(e);
                }
            };

            const restartChild = (taskAction: () => void, execArgv: string[]) => {
                try {
                    assert(runningChildren.has(child), `${processIndex}> Child not running`);
                    console.log(`${processIndex}> Restarting...`);
                    stopChild(/*done*/ false);
                    startChild(taskAction, execArgv);
                } catch (e) {
                    onError(e);
                }
            };

            const resumeTask = () => {
                try {
                    assert(runningChildren.has(child), `${processIndex}> Child not running`);
                    child.send(currentInput);
                } catch (e) {
                    onError(e);
                }
            };

            const nextTask = () => {
                try {
                    assert(runningChildren.has(child), `${processIndex}> Child not running`);
                    currentInput = inputs[inputIndex];
                    inputIndex++;
                    if (handleStart) {
                        handleStart(currentInput, processIndex);
                    }
                    child.send(currentInput);
                } catch (e) {
                    onError(e);
                }
            };

            startChild(nextTask, process.execArgv);
        }

        function fail(err?: Error): void {
            if (!rejected) {
                rejected = true;
                for (const child of runningChildren) {
                    try {
                        child.removeAllListeners();
                        child.kill();
                    } catch {
                        // do nothing
                    }
                }
                const message = err ? `: ${err.message}` : "";
                reject(new Error(`Something went wrong in ${runWithListeningChildProcesses.name}${message}`));
            }
        }
    });
}

const maxOldSpaceSizeRegExp = /^--max[-_]old[-_]space[-_]size(?:$|=(\d+))/;

interface MaxOldSpaceSizeArgument {
    index: number;
    size: number;
    value: number | undefined;
}

function getMaxOldSpaceSizeArg(argv: ReadonlyArray<string>): MaxOldSpaceSizeArgument | undefined {
    for (let index = 0; index < argv.length; index++) {
        const match = maxOldSpaceSizeRegExp.exec(argv[index]);
        if (match) {
            const value = match[1] ? parseInt(match[1], 10) :
                argv[index + 1] ? parseInt(argv[index + 1], 10) :
                undefined;
            const size = match[1] ? 1 : 2; // tslint:disable-line:no-magic-numbers
            return { index, size, value };
        }
    }
    return undefined;
}

function getMaxOldSpaceSize(argv: ReadonlyArray<string>): number | undefined {
    const arg = getMaxOldSpaceSizeArg(argv);
    return arg && arg.value;
}

let execArgvWithoutMaxOldSpaceSize: ReadonlyArray<string> | undefined;

function getExecArgvWithoutMaxOldSpaceSize(): ReadonlyArray<string> {
    if (!execArgvWithoutMaxOldSpaceSize) {
        // remove --max_old_space_size from execArgv
        const execArgv = process.execArgv.slice();
        let maxOldSpaceSizeArg = getMaxOldSpaceSizeArg(execArgv);
        while (maxOldSpaceSizeArg) {
            execArgv.splice(maxOldSpaceSizeArg.index, maxOldSpaceSizeArg.size);
            maxOldSpaceSizeArg = getMaxOldSpaceSizeArg(execArgv);
        }
        execArgvWithoutMaxOldSpaceSize = execArgv;
    }
    return execArgvWithoutMaxOldSpaceSize;
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

// Based on `getPackageNameFromAtTypesDirectory` in TypeScript.
export function unmangleScopedPackage(packageName: string): string | undefined {
    const separator = "__";
    return packageName.includes(separator) ? `@${packageName.replace(separator, "/")}` : undefined;
}

/** Returns [values that cb returned undefined for, defined results of cb]. */
export function split<T, U>(inputs: ReadonlyArray<T>, cb: (t: T) => U | undefined): [ReadonlyArray<T>, ReadonlyArray<U>] {
    const keep: T[] = [];
    const splitOut: U[] = [];
    for (const input of inputs) {
        const res = cb(input);
        if (res === undefined) { keep.push(input); } else { splitOut.push(res); }
    }
    return [keep, splitOut];
}

export function assertSorted(a: ReadonlyArray<string>): ReadonlyArray<string>;
export function assertSorted<T>(a: ReadonlyArray<T>, cb: (t: T) => string): ReadonlyArray<T>;
export function assertSorted<T>(a: ReadonlyArray<T>, cb: (t: T) => string = (t: T) => t as unknown as string): ReadonlyArray<T> {
    let prev = a[0];
    for (let i = 1; i < a.length; i++) {
        const x = a[i];
        assert(cb(x) >= cb(prev), `${JSON.stringify(x)} >= ${JSON.stringify(prev)}`);
        prev = x;
    }
    return a;
}

import * as fsp from "fs-promise";
import * as path from "path";

import { home } from "../lib/common";
import { writeFile } from "./io";

/** Anything capable of receiving messages is a logger. */
export type Logger = (message: string) => void;

/** Recording of every message sent to a Logger. */
export type Log = string[];

/** Stores two separate loggers. */
export interface LoggerWithErrors {
	info: Logger;
	error: Logger;
}

/** Recording of every message sent to a LoggerWithErrors. */
export interface LogWithErrors {
	infos: Log;
	errors: Log;
}

/** Logger that *just* outputs to the console and does not save anything. */
export const consoleLogger: LoggerWithErrors = {
	info: console.log,
	error: console.error
};

/** Logger that *just* records writes and does not output to console. */
export function quietLogger(): [Logger, () => Log] {
	const logged: Log = [];
	return [ (message: string) => logged.push(message), () => logged ];
}

/** Performs a side-effect and also records all logs. */
function alsoConsoleLogger(consoleLog: Logger): [Logger, () => Log] {
	const [log, logResult] = quietLogger();
	return [
		(message: string) => {
			consoleLog(message);
			log(message);
		},
		logResult
	];
}

/** Logger that writes to console in addition to recording a result. */
export function logger(): [Logger, () => Log]  {
	return alsoConsoleLogger(console.log);
}

/** Helper for creating `info` and `error` loggers together. */
function loggerWithErrorsHelper(logger: () => [Logger, () => Log]): [LoggerWithErrors, () => LogWithErrors] {
	const [info, infoResult] = logger();
	const [error, errorResult] = logger();
	return [
		{ info, error },
		() => ({ infos: infoResult(), errors: errorResult() })
	];
}

/** Records `info` and `error` messages without writing to console. */
export function quietLoggerWithErrors(): [LoggerWithErrors, () => LogWithErrors] {
	return loggerWithErrorsHelper(quietLogger);
}

/** Records `info` and `error` messages, calling appropriate console methods as well. */
export function loggerWithErrors(): [LoggerWithErrors, () => LogWithErrors] {
	return loggerWithErrorsHelper(logger);
}

/**
 * Move everything from one Log to another logger.
 * This is useful for performing several tasks in parallel, but outputting their logs in sequence.
 */
export function moveLogs(dest: Logger, src: Log, mapper?: (message: string) => string): void {
	for (const line of src) {
		dest(mapper ? mapper(line) : line);
	}
}

/** Perform `moveLogs` for both parts of a LogWithErrors. */
export function moveLogsWithErrors(dest: LoggerWithErrors, {infos, errors}: LogWithErrors, mapper?: (message: string) => string): void {
	moveLogs(dest.info, infos, mapper);
	moveLogs(dest.error, errors, mapper);
}

const logDir = path.join(home, "logs");

export function logPath(logName: string) {
	return path.join(logDir, logName);
}

export async function writeLog(logName: string, contents: string[]): Promise<void> {
	await fsp.ensureDir(logDir);
	await writeFile(logPath(logName), contents.join("\r\n"));
}

export function joinLogWithErrors({infos, errors}: LogWithErrors): Log {
	return errors.length ? infos.concat(["", "=== ERRORS ===", ""], errors) : infos;
}

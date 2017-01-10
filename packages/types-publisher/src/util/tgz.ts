import { createWriteStream } from "fs";
import { Reader } from "fstream";
import { Pack } from "tar";
import * as zlib from "zlib";
import { streamDone } from "./io";

export function gzip(input: NodeJS.ReadableStream): NodeJS.ReadableStream {
	return input.pipe(zlib.createGzip());
}

export function unGzip(input: NodeJS.ReadableStream): NodeJS.ReadableStream {
	const output = zlib.createGunzip();
	input.pipe(output);
	return output;
}

export function writeTgz(inputDirectory: string, outFileName: string) {
	return new Promise<void>((resolve, reject) => {
		resolve(streamDone(createTgz(inputDirectory, reject).pipe(createWriteStream(outFileName))));
	});
}

// To output this for testing: Export it and:
// `require("./bin/lib/npm-client").createTgz("./output/foo", err => { throw err }).pipe(fs.createWriteStream("foo.tgz"))`
export function createTgz(dir: string, onError: (error: Error) => void): NodeJS.ReadableStream {
	return gzip(createTar(dir, onError));
}

function createTar(dir: string, onError: (error: Error) => void): NodeJS.ReadableStream {
	const packer = Pack({ noProprietary: true } as any)
		.on("error", onError);

	return Reader({ path: dir, type: "Directory", filter: addDirectoryExecutablePermission } as any)
		.on("error", onError)
		.pipe(packer);
}

/**
 * Work around a bug where directories bundled on Windows do not have executable permission when extracted on Linux.
 * https://github.com/npm/node-tar/issues/7#issuecomment-17572926
 */
function addDirectoryExecutablePermission(entry: any): boolean {
	if (entry.props.type === "Directory") {
		entry.props.mode = addExecutePermissionsFromReadPermissions(entry.props.mode);
	}
	return true;
}

function addExecutePermissionsFromReadPermissions(mode: number): number {
	// Constant that gives execute permissions to owner, group, and others. "+x"
	const allExecutePermissions = 0o111;
	// Moves the bits for read permissions into the place for execute permissions.
	// In other words, a component will have execute permissions if it has read permissions.
	const readPermissionsAsExecutePermissions = (mode >>> 2) & allExecutePermissions;
	// Add these additional execute permissions to the mode.
	return mode |= readPermissionsAsExecutePermissions;
}

import * as fsp from "fs-promise";

import { TypeScriptVersion } from "../lib/packages";
import { writeJson } from "../util/io";
import { execAndThrowErrors, joinPaths } from "../util/util";

const installsDir = joinPaths(__dirname, "..", "..", "typescript-installs");

export async function installAllTypeScriptVersions(): Promise<void> {
	console.log("Installing TypeScript versions...");

	await fsp.mkdirp(installsDir);
	for (const version of TypeScriptVersion.All) {
		const dir = installDir(version);
		await fsp.mkdirp(dir);
		await writeJson(joinPaths(dir, "package.json"), packageJson(version));
		await execAndThrowErrors("npm install", dir);
	}
}

export function pathToTsc(version: TypeScriptVersion): string {
	return joinPaths(installDir(version), "node_modules", "typescript", "lib", "tsc.js");
}

function installDir(version: TypeScriptVersion) {
	return joinPaths(installsDir, version);
}

function packageJson(version: TypeScriptVersion): {} {
	return {
		name: "ts-install",
		version: "0.0.0",
		dependencies: {
			typescript: `${version}.x`
		}
	};
}

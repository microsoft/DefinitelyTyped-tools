import fs = require("fs");
import { remove } from "fs-extra";
import https = require("https");
import StreamZip = require("node-stream-zip");

import { Options } from "./lib/common";
import { definitelyTypedZipUrl } from "./lib/settings";
import { done, exec } from "./util/util";

if (!module.parent) {
	done(main(Options.defaults));
}

export default async function main(options: Options): Promise<void> {
	if (options.downloadDefinitelyTyped) {
		const zipPath = `${options.definitelyTypedPath}.zip`;
		await downloadFile(definitelyTypedZipUrl, zipPath);
		await remove(options.definitelyTypedPath);
		await extract(zipPath, options.definitelyTypedPath);
	} else {
		const { error, stderr, stdout } = await exec("git diff --name-only", options.definitelyTypedPath);
		if (error) { throw error; }
		if (stderr) { throw new Error(stderr); }
		if (stdout) { throw new Error(`'git diff' should be empty. Following files changed:\n${stdout}`); }
	}
}

function downloadFile(url: string, outFilePath: string): Promise<void> {
	const file = fs.createWriteStream(outFilePath);
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			response.pipe(file);
			file.on("finish", () => {
				file.close();
				resolve();
			});
		}).on("error", reject);
	});
}

function extract(zipFilePath: string, outDirectoryPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const zip = new StreamZip({ file: zipFilePath });
		zip.on("error", reject);
		zip.on("ready", () => {
			fs.mkdirSync(outDirectoryPath);
			zip.extract(undefined, outDirectoryPath, err => {
				zip.close();
				if (err) { reject(err); } else { resolve(); }
			});
		});
	});
}

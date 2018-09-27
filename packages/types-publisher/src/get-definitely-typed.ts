import { ensureDir, remove } from "fs-extra";
import https = require("https");
import tar = require("tar-fs");
import * as zlib from "zlib";

import { dataDir, Options } from "./lib/common";
import { definitelyTypedZipUrl } from "./lib/settings";
import { assertDefined, done, exec, withoutStart } from "./util/util";

if (!module.parent) {
	done(main(Options.azure));
}

export default async function main(options: Options): Promise<void> {
	if (options.downloadDefinitelyTyped) {
		await ensureDir(dataDir);
		await remove(options.definitelyTypedPath);
		await downloadAndExtractFile(definitelyTypedZipUrl, options.definitelyTypedPath);
	} else {
		const { error, stderr, stdout } = await exec("git diff --name-only", options.definitelyTypedPath);
		if (error) { throw error; }
		if (stderr) { throw new Error(stderr); }
		if (stdout) { throw new Error(`'git diff' should be empty. Following files changed:\n${stdout}`); }
	}
}

function downloadAndExtractFile(url: string, outDirectoryPath: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		https.get(url, response => {
			const tarOut = tar.extract(outDirectoryPath, {
				map: header =>
					({ ...header, name: assertDefined(withoutStart(header.name, "DefinitelyTyped-master/")) }),
			});
			response.pipe(zlib.createGunzip()).pipe(tarOut);
			tarOut.on("error", reject);
			tarOut.on("finish", () => {
				resolve();
			});
		}).on("error", reject);
	});
}

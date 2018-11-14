import { remove } from "fs-extra";

import { logUncaughtErrors } from "./util/util";

if (!module.parent) {
	logUncaughtErrors(clean());
}

export default async function clean(): Promise<void> {
	for (const dir of ["data", "logs", "output"]) {
		console.log(`Clean ${dir}`);
		await remove(dir);
	}
}

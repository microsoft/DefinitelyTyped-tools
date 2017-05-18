import { remove } from "fs-extra";

import { done } from "./util/util";

if (!module.parent) {
	done(main());
}

export default async function main(): Promise<void> {
	for (const dir of ["data", "logs", "output"]) {
		console.log("Clean " + dir);
		await remove(dir);
	}
}

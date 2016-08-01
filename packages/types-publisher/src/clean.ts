import * as fsp from "fs-promise";

if (!module.parent) {
	main();
}

export default function main(): void {
	for (const dir of ["data", "logs", "output"]) {
		console.log("Clean " + dir);
		fsp.remove(dir);
	}
}

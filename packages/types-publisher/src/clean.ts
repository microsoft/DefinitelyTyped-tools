import * as rimraf from "rimraf";

if (!module.parent) {
	main();
}

export default function main() {
	for (const dir of ["data", "logs", "output"]) {
		console.log("Clean " + dir);
		rimraf.sync(dir);
	}
}

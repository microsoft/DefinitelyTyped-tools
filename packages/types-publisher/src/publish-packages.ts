import * as fs from "fs";
import * as yargs from "yargs";
import * as common from "./lib/common";
import * as publisher from "./lib/package-publisher";

const typeData = <common.TypesDataFile> common.readDataFile(common.typesDataFilename);

if (typeData === undefined || fs.readdirSync("./output").length === 0) {
	throw new Error("Run parse-definitions and generate-packages first!");
}

const dry = !!yargs.argv.dry;

const log: string[] = [];
if (dry) {
	console.log("=== DRY RUN ===");
	log.push("=== DRY RUN ===");
}

const typingsPackages = Object.keys(typeData).map(key => typeData[key]);
const publishQueue: common.AnyPackage[] = (typingsPackages as common.AnyPackage[]).concat(common.readNotNeededPackages());
next();

function next() {
	common.writeLogSync("publishing.md", log);
	if (publishQueue.length === 0) {
		console.log("Done!");
		return;
	}

	const typing = publishQueue.shift();
	const packageName = typing.libraryName;
	console.log(`Publishing ${packageName}...`);

	publisher.publishPackage(typing, dry, (publishLog: common.Log) => {
		log.push(` * ${packageName}`);
		publishLog.infos.forEach(line => log.push(`   * ${line}`));

		publishLog.errors.forEach(err => {
			log.push(`   * ERROR: ${err}`);
			console.log(` Error! ${err}`);
		});

		next();
	});
}

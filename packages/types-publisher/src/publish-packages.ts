import * as fs from "fs";
import * as yargs from "yargs";
import * as common from "./lib/common";
import * as publisher from "./lib/package-publisher";
import { nAtATime } from "./lib/util";

if (!module.parent) {
	if (!common.existsTypesDataFile() || !fs.existsSync("./output") || fs.readdirSync("./output").length === 0) {
		console.log("Run parse-definitions and generate-packages first!");
	}
	else {
		const dry = !!yargs.argv.dry;
		// For testing only. Do not use on real @types repo.
		const shouldUnpublish = !!yargs.argv.unpublish;

		(shouldUnpublish ? unpublish : main)(dry).catch(console.error);
	}
}

export default async function main(dry: boolean): Promise<void> {
	const log: string[] = [];
	if (dry) {
		console.log("=== DRY RUN ===");
		log.push("=== DRY RUN ===");
	}

	const packagesShouldPublish: common.AnyPackage[] = [];

	log.push("Checking which packages we should publish");
	await nAtATime(100, allPackages(), async pkg => {
		const [shouldPublish, checkLog] = await publisher.shouldPublish(pkg);

		if (shouldPublish) {
			packagesShouldPublish.push(pkg);
		}

		log.push(`Checking ${pkg.libraryName}...`);
		writeLogs(checkLog);
	});

	for (const pkg of packagesShouldPublish) {
		console.log(`Publishing ${pkg.libraryName}...`);
		const publishLog = await publisher.publishPackage(pkg, dry);
		writeLogs(publishLog);
	}

	function writeLogs(res: common.LogResult): void {
		for (const line of res.infos) {
			log.push(`   * ${line}`);
		}
		for (const err of res.errors) {
			log.push(`   * ERROR: ${err}`);
			console.error(` Error! ${err}`);
		}
	}

	common.writeLogSync("publishing.md", log);
	console.log("Done!");
}

async function unpublish(dry: boolean): Promise<void> {
	for (const pkg of allPackages()) {
		await publisher.unpublishPackage(pkg, dry);
	}
}

function allPackages(): common.AnyPackage[] {
	return (common.readTypings() as common.AnyPackage[]).concat(common.readNotNeededPackages());
}

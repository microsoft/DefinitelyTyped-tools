import * as fs from "fs";
import * as yargs from "yargs";
import * as common from "./lib/common";
import NpmClient from "./lib/npm-client";
import * as publisher from "./lib/package-publisher";
import { done, nAtATime } from "./lib/util";

if (!module.parent) {
	if (!common.existsTypesDataFile() || !fs.existsSync("./output") || fs.readdirSync("./output").length === 0) {
		console.log("Run parse-definitions and generate-packages first!");
	}
	else {
		const dry = !!yargs.argv.dry;
		const singleName = yargs.argv.single;
		// For testing only. Do not use on real @types repo.
		const shouldUnpublish = !!yargs.argv.unpublish;

		if (singleName && shouldUnpublish) {
			throw new Error("Select only one --singleName=foo or --shouldUnpublish");
		}

		done(go());

		async function go(): Promise<void> {
			if (shouldUnpublish) {
				await unpublish(dry);
			}
			else {
				const client = await NpmClient.create();
				if (singleName) {
					await single(client, singleName, dry);
				}
				else {
					await main(client, dry);
				}
			}
		}
	}
}

export default async function main(client: NpmClient, dry: boolean): Promise<void> {
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

	packagesShouldPublish.sort((pkgA, pkgB) => pkgA.libraryName.localeCompare(pkgB.libraryName));

	for (const pkg of packagesShouldPublish) {
		console.log(`Publishing ${pkg.libraryName}...`);
		const publishLog = await publisher.publishPackage(client, pkg, dry);
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

async function single(client: NpmClient, name: string, dry: boolean): Promise<void> {
	const pkg = allPackages().find(p => p.typingsPackageName === name);
	if (pkg === undefined) {
		throw new Error(`Can't find a package named ${name}`);
	}

	const publishLog = await publisher.publishPackage(client, pkg, dry);

	console.log(publishLog);
}

async function unpublish(dry: boolean): Promise<void> {
	for (const pkg of allPackages()) {
		await publisher.unpublishPackage(pkg, dry);
	}
}

function allPackages(): common.AnyPackage[] {
	return (common.readTypings() as common.AnyPackage[]).concat(common.readNotNeededPackages());
}

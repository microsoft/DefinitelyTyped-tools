import * as common from './lib/common';
import * as publisher from './lib/package-publisher';

const typeData = <common.TypesDataFile>common.readDataFile(common.typesDataFilename);

if (typeData === undefined) {
	console.log('Run parse-definitions and generate-packages first!');
} else {
	main();
}

function main() {
	const log: string[] = [];
	const publishQueue = Object.keys(typeData);
	next();

	function next() {
		common.writeLogSync('publishing.md', log);
		if (publishQueue.length === 0) {
			console.log('Done!');
			return;
		}

		const packageName = publishQueue.shift();
		console.log(`Publishing ${packageName}...`);

		const typing = typeData[packageName];
		publisher.publishPackage(typing, (publishLog, errors) => {
			log.push(` * ${packageName}`);
			publishLog.forEach(line => log.push(`   * ${line}`));

			errors.forEach(err => {
				log.push(`   * ERROR: ${err}`);
				console.log(` Error! ${err}`);
			});

			next();
		});
	}
}

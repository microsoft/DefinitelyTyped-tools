import * as fs from 'fs'
import * as common from './lib/common';
import * as generator from './lib/package-generator';

const typeData = <common.TypesDataFile>common.readDataFile(common.typesDataFilename);

if (typeData === undefined) {
	throw new Error('Run parse-definitions first!');
}

const log: string[] = [];
Object.keys(typeData).forEach(packageName => {
	const typing = typeData[packageName];
	logGeneration(typing, generator.generatePackage(typing, typeData));
});

for (const pkg of common.readNotNeededPackages()) {
	logGeneration(pkg, generator.generateNotNeededPackage(pkg));
}

common.writeLogSync('package-generator.md', log);

function logGeneration(pkg: common.AnyPackage, generateResult: { log: string[] }): void {
	log.push(` * ${pkg.libraryName}`);
	generateResult.log.forEach(line => log.push(`   * ${line}`));
}

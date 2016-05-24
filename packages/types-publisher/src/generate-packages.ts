import * as common from './lib/common';
import * as generator from './lib/package-generator';

const typeData = <common.TypesDataFile>common.readDataFile(common.typesDataFilename);

if (typeData === undefined) {
	console.log('Run parse-definitions first!');
} else {
	const log: string[] = [];
	Object.keys(typeData).forEach(packageName => {
		const typing = typeData[packageName];
		const result = generator.generatePackage(typing, typeData);
		log.push(` * ${packageName}`);
		result.log.forEach(line => log.push(`   * ${line}`));
	});
	common.writeLogSync('package-generator.md', log);
}

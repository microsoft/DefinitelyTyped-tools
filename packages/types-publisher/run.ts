/// <reference path="typings/node/node.d.ts" />

import * as parser from './definition-parser';

import fs = require('fs');
import path = require('path');

const scopeName = '@ryancavanaugh';
const versionFile = 'versions.json';

const DefinitelyTypedPath = '../DefinitelyTyped';
const OutputPath = './output/';

const summaryLog: string[] = [];
const detailedLog: string[] = [];

interface VersionMap {
	[typingsPackageName: string]: string;
}


function processDir(folderPath: string, name: string) {
	detailedLog.push(`## ${name}`);

	const info = parser.getTypingInfo(folderPath);

	for(const line of info.log) detailedLog.push('> ' + line);
	detailedLog.push('');

	if (info.data) {
		console.log(`Good news! ${name} is ${parser.DefinitionFileKind[info.data.type]}`);
	}
}

interface TypeFileInfo {
	folder: string;
	filename: string;
	libraryName: string;
	version?: string;
	references: string[];
	imports: string[];
}


function main() {
	summaryLog.push('# Typing Publish Report');
	summaryLog.push(`Started at ${(new Date()).toUTCString()}`);

	fs.readdir(DefinitelyTypedPath, (err, paths) => {
		const folders = paths
			// Remove hidden paths
			.filter(s => s.substr(0, 1) !== '_' && s.substr(0, 1) !== '.')
			// Combine paths
			.map(s => ({ name: s, path: path.join(DefinitelyTypedPath, s) }))
			// Remove non-folders
			.filter(s => fs.statSync(s.path).isDirectory())
		console.log(`Found ${folders.length} typings folders.`);

		folders.forEach(s => processDir(s.path, s.name));

		

		fs.writeFile('log.md', summaryLog.join('\r\n'), 'utf-8');
	});
}

main();

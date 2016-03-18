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
const outcomes: { [s: string]: number } = {};

function recordOutcome(s: string) {
	outcomes[s] = (outcomes[s] || 0) + 1;
}

interface VersionMap {
	[typingsPackageName: string]: string;
}

function processDir(folderPath: string, name: string) {
	detailedLog.push(`## ${name}`);

	const info = parser.getTypingInfo(folderPath);

	if (parser.isSuccess(info)) {
		detailedLog.push('### Succeeded');
		detailedLog.push(`Detected a ${parser.DefinitionFileKind[info.data.type]} typing definition.`);
		detailedLog.push('```js');
		detailedLog.push(JSON.stringify(info.data, undefined, 4));
		detailedLog.push('```');
		recordOutcome(`Succeeded (${parser.DefinitionFileKind[info.data.type]})`);
	} else if(parser.isFail(info)) {
		detailedLog.push('### Failed');
		switch (info.rejectionReason) {
			case parser.RejectionReason.BadFileFormat:
				recordOutcome('Failed: Bad file format');
				detailedLog.push('Bad file format');
				break;
			case parser.RejectionReason.ReferencePaths:
				recordOutcome('Failed: Reference paths not allowed');
				detailedLog.push('Reference paths are not allowed (use library references instead)');
				break;
			case parser.RejectionReason.TooManyFiles:
				recordOutcome('Failed: Too many files');
				detailedLog.push('Failed: Only one .d.ts file per folder is currently supported');
				break;
			default:
				recordOutcome('??');
		}
	}

	detailedLog.push('### Parser Log');
	for(const line of info.log) detailedLog.push('> ' + line);
	detailedLog.push('');
}

function main() {
	summaryLog.push('# Typing Publish Report Summary');
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

		summaryLog.push('\r\n### Overall Results');
		const outcomeKeys = Object.keys(outcomes);
		outcomeKeys.sort();
		outcomeKeys.forEach(k => {
			summaryLog.push(` * ${k}: ${outcomes[k]}`);
		});

		const logmd = summaryLog.join('\r\n') + '\r\n\r\n# Detailed Report\r\n\r\n' + detailedLog.join('\r\n');
		fs.writeFile('log.md', logmd, 'utf-8');
	});
}

main();

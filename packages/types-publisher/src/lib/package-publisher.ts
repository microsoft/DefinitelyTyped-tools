import { TypingsData, DefinitionFileKind, mkdir, getOutputPath, settings } from './common';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as request from 'request';

interface NpmRegistryResult {
	versions: {
		[key: string]: {};
	}
	error: string;
}

export function publishPackage(typing: TypingsData, done: (log: string[], errors: string[]) => void) {
	const log: string[] = [];
	const errors: string[] = [];

	const outputPath = getOutputPath(typing);

	log.push(`Possibly publishing ${typing.libraryName}`);

	// Read package.json for version number we would be publishing
	const localVersion: string = JSON.parse(fs.readFileSync(path.join(outputPath, 'package.json'), 'utf-8')).version;
	log.push(`Local version from package.json is ${localVersion}`);

	// Hit e.g. http://registry.npmjs.org/@ryancavanaugh%2fjquery for version data
	const registryUrl = `http://registry.npmjs.org/@${settings.scopeName}%2F${typing.typingsPackageName}`;
	log.push(`Fetch registry data from ${registryUrl}`);

	// See if this version already exists
	request.get(registryUrl, (err: any, resp: any, bodyString: string) => {
		const body: NpmRegistryResult = JSON.parse(bodyString);

		if (body.error === "Not found") {
			// OK, just haven't published this one before
			log.push('Registry indicates this is a new package');
		} else if (body.error) {
			// Critical failure
			log.push('Unexpected response, refer to error log');
			errors.push(`NPM registry failure for ${registryUrl}: Unexpected error content ${body.error})`);
			done(log, errors);
			return;
		} else {
			const remoteVersionExists = body.versions[localVersion] !== undefined;
			if (remoteVersionExists) {
				log.push(`Remote version already exists`);
				done(log, errors);
				return;
			} else {
				log.push(`Remote version does not exist`);
			}
		}

		// Made it to here, so proceed with update
		const args: string[] = ['npm', 'publish', path.resolve(outputPath), '--access public'];
		if (settings.tag) {
			args.push(`--tag ${settings.tag}`);
		}

		const cmd = args.join(' ');
		log.push(`Run ${cmd}`);
		try {
			const result = <string>child_process.execSync(cmd, { encoding: 'utf-8' });
			log.push(`Ran successfully`);
			log.push(result);
		} catch(e) {
			errors.push(`Publish failed: ${JSON.stringify(e)}`);
			log.push('Publish failed, refer to error log');
		}

		done(log, errors);
	});
}


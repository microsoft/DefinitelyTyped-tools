import assert = require("assert");
import RegClient = require("npm-registry-client");
import * as url from "url";

import { fetchJson, readFile } from "../util/io";
import { createTgz } from "../util/tgz";
import { joinPaths } from "../util/util";

import { getSecret, Secret } from "./secrets";
import { npmRegistry } from "./settings";

assert(npmRegistry.endsWith("/"));

function packageUrl(packageName: string): string {
	return url.resolve(npmRegistry, packageName);
}

export default class NpmClient {
	static async create(config?: RegClient.Config): Promise<NpmClient> {
		const token = await getSecret(Secret.NPM_TOKEN);
		return new this(new RegClient(config), { token });
	}

	private constructor(private readonly client: RegClient, private readonly auth: RegClient.Credentials) {}

	async publish(publishedDirectory: string, packageJson: {}, dry: boolean): Promise<void> {
		const readme = await readFile(joinPaths(publishedDirectory, "README.md"));

		return new Promise<void>((resolve, reject) => {
			const body = createTgz(publishedDirectory, reject);
			const metadata = { readme, ...packageJson };

			const params: RegClient.PublishParams = {
				access: "public",
				auth: this.auth,
				metadata,
				body,
			};

			if (dry) {
				resolve();
			} else {
				this.client.publish(npmRegistry, params, err => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}
		});
	}

	tag(packageName: string, version: string, tag: string): Promise<void> {
		const params = {
			version,
			tag,
			auth: this.auth
		};
		return promisifyVoid(cb => { this.client.tag(packageUrl(packageName), params, cb); });
	}

	deprecate(packageName: string, version: string, message: string): Promise<void> {
		const url = packageUrl(packageName.replace("/", "%2f"));
		const params = {
			message,
			version,
			auth: this.auth,
		};
		return promisifyVoid(cb => { this.client.deprecate(url, params, cb); });
	}
}

function promisifyVoid(callsBack: (cb: (error: Error | undefined) => void) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		callsBack(error => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

export interface NpmInfo {
	readonly error?: string;
	readonly version: string;
	readonly "dist-tags": {
		readonly [tag: string]: string;
	};
	readonly versions: NpmInfoVersions;
}
export interface NpmInfoVersions {
	readonly [version: string]: NpmInfoVersion;
}
export interface NpmInfoVersion {
	readonly typesPublisherContentHash: string;
	readonly deprecated?: string;
}
export async function fetchNpmInfo(escapedPackageName: string): Promise<NpmInfo> {
	const uri = npmRegistry + escapedPackageName;
	const info = (await fetchJson(uri, { retries: true })) as { readonly error: string } | NpmInfo;
	if ("error" in info) {
		throw new Error(`Error getting version at ${uri}: ${info.error}`);
	}
	return info;
}

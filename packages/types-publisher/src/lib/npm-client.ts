import assert = require("assert");
import RegClient = require("npm-registry-client");
import * as path from "path";
import * as url from "url";

import { readFile } from "../util/io";
import { createTgz } from "../util/tgz";

import { settings } from "./common";
import { getSecret, Secret } from "./secrets";

const registry = settings.npmRegistry;
assert(registry.endsWith("/"));

function packageUrl(packageName: string): string {
	return url.resolve(registry, packageName);
}

export default class NpmClient {
	static async create(): Promise<NpmClient> {
		const token = await getSecret(Secret.NPM_TOKEN);
		return new this(new RegClient({}), { token });
	}

	private constructor(private client: RegClient, private auth: RegClient.Credentials) {}

	async publish(publishedDirectory: string, packageJson: {}, dry: boolean): Promise<void> {
		const readme = await readFile(path.join(publishedDirectory, "README.md"));

		return new Promise<void>((resolve, reject) => {
			const body = createTgz(publishedDirectory, reject);
			const metadata = Object.assign({ readme }, packageJson);

			const params = {
				access: <"public"> "public",
				auth: this.auth,
				metadata,
				body
			};

			if (dry) {
				resolve();
			}
			else {
				this.client.publish(registry, params, err => {
					if (err) {
						reject(err);
					}
					else {
						resolve();
					}
				});
			}
		});
	}

	tag(packageName: string, version: string, tag: string) {
		const params = {
			version,
			tag,
			auth: this.auth
		};
		return promisifyVoid(cb => this.client.tag(packageUrl(packageName), params, cb));
	}

	deprecate(packageName: string, version: string, message: string): Promise<void> {
		const url = packageUrl(packageName.replace("/", "%2f"));
		const params = {
			message,
			version,
			auth: this.auth,
		};
		return promisifyVoid(cb => this.client.deprecate(url, params, cb));
	}
}

function promisifyVoid(callsBack: (cb: (error: Error | undefined) => void) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		callsBack(error => {
			if (error) {
				reject(error);
			}
			else {
				resolve();
			}
		});
	});
}

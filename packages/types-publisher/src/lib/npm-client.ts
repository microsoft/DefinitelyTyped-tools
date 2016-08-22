import assert = require("assert");
import { Reader } from "fstream";
import RegClient = require("npm-registry-client");
import * as path from "path";
import { Pack } from "tar";
import * as url from "url";
import { settings } from "./common";
import { gzip, readFile } from "./util";

const registry = settings.npmRegistry;
assert(registry.endsWith("/"));
const username = settings.npmUsername;

function packageUrl(packageName: string): string {
	return url.resolve(registry, packageName);
}

export default class NpmClient {
	static async create(): Promise<NpmClient> {
		const password = process.env.NPM_PASSWORD;
		if (!password) {
			throw new Error("Must provide NPM_PASSWORD");
		}
		const client = new RegClient({});
		return new this(client, await logIn(client, password));
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
		const params = {
			message,
			version,
			auth: this.auth,
		};
		return promisifyVoid(cb => this.client.deprecate(packageUrl(packageName), params, cb));
	}
}

async function logIn(client: RegClient, password: string): Promise<RegClient.Credentials> {
	// Based on https://github.com/npm/npm-registry-client/issues/135#issuecomment-207410721
	const user = {
		_id: "org.couchdb.user:" + username,
		name: username,
		password,
		type: "user",
		roles: <any> [],
		date: new Date().toISOString()
	};

	const uri = url.resolve(registry, "-/user/org.couchdb.user:" + encodeURIComponent(username));
	const params  = {
		method: "PUT",
		body: user
	};

	const token = await new Promise<string>((resolve, reject) => {
		client.request(uri, params, (error, data) => {
			if (error) {
				reject(error);
			}
			if (!data.token) {
				throw new Error("No token returned");
			}
			resolve(data.token);
		});
	});

	return { token };
}

// To output this for testing: Export it and:
// `require("./bin/lib/npm-client").createTgz("./output/foo", err => { throw err }).pipe(fs.createWriteStream("foo.tgz"))`
function createTgz(dir: string, onError: (error: Error) => void): NodeJS.ReadableStream {
	return gzip(createTar(dir, onError));
}

function createTar(dir: string, onError: (error: Error) => void): NodeJS.ReadableStream {
	const packer = Pack(<any> { noProprietary: true })
		.on("error", onError);

	return Reader({ path: dir, type: "Directory" })
		.on("error", onError)
		.pipe(<any> packer);
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

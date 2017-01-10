import fetch from "node-fetch";
import * as yargs from "yargs";

import { getSecret, Secret } from "./lib/secrets";
import { sourceBranch } from "./lib/settings";
import { expectedSignature } from "./lib/webhook-server";
import { done } from "./util/util";

if (!module.parent) {
	const remote = yargs.argv.remote;

	function getPort() {
		const port = parseInt(process.env.PORT, 10);
		if (!port) {
			throw new Error("Must provide PORT");
		}
		return port;
	}

	const url = remote ? "http://types-publisher.azurewebsites.net" : `http://localhost:${getPort()}`;
	done(main(url));
}

async function main(url: string): Promise<void> {
	const key = await getSecret(Secret.GITHUB_SECRET);
	const body = JSON.stringify({ ref: `refs/heads/${sourceBranch}` });
	const headers = { "x-hub-signature": expectedSignature(key, body) };
	const resp = await fetch(url, { method: "POST", body, headers });
	console.log(await resp.text());
}

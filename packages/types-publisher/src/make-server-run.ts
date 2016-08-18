import fetch = require("node-fetch");
import { settings } from "./lib/common";
import { done } from "./lib/util";
import { expectedSignature } from "./lib/webhook-server";
import * as yargs from "yargs";

if (!module.parent) {
	const remote = yargs.argv.remote;
	const key = process.env["GITHUB_SECRET"];
	if (!key) {
		throw new Error("Must provide GITHUB_SECRET");
	}

	function getPort() {
		const port = parseInt(process.env["PORT"], 10);
		if (!port) {
			throw new Error("Must provide PORT");
		}
		return port;
	}

	const url = remote ? "http://types-publisher.azurewebsites.net" : `http://localhost:${getPort()}`;
	done(main(key, url));
}

async function main(key: string, url: string): Promise<void> {
	const body = JSON.stringify({ ref: `refs/heads/${settings.sourceBranch}` });
	const headers = { "x-hub-signature": expectedSignature(key, body) };
	const resp = await fetch(url, { method: "POST", body, headers });
	console.log(await resp.text());
}

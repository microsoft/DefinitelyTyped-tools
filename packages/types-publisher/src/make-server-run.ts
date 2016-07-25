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
	done(main(key, remote));
}

async function main(key: string, remote: boolean): Promise<void> {
	// lvh.me reroutes to localhost
	const url = remote ? "http://types-publisher.azurewebsites.net" : "http://lvh.me";
	const body = JSON.stringify({ ref: `refs/heads/${settings.sourceBranch}` });
	const headers = { "x-hub-signature": expectedSignature(key, body) };
	const resp = await fetch(url, { method: "POST", body, headers });
	console.log(await resp.text());
}

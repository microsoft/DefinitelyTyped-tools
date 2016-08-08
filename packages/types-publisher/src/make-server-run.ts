import fetch = require("node-fetch");
import { settings } from "./lib/common";
import { done } from "./lib/util";
import { expectedSignature } from "./lib/webhook-server";
import * as yargs from "yargs";

if (!module.parent) {
	const remote = yargs.argv.remote;
	const key = process.env["GITHUB_SECRET"];
	const port = parseInt(process.env["PORT"], 10);
	if (!(key && port)) {
		throw new Error("Must provide GITHUB_SECRET and PORT");
	}
	done(main(key, port, remote));
}

async function main(key: string, port: number, remote: boolean): Promise<void> {
	const url = remote ? "http://types-publisher.azurewebsites.net" : `http://localhost:${port}`;
	const body = JSON.stringify({ ref: `refs/heads/${settings.sourceBranch}` });
	const headers = { "x-hub-signature": expectedSignature(key, body) };
	const resp = await fetch(url, { method: "POST", body, headers });
	console.log(await resp.text());
}

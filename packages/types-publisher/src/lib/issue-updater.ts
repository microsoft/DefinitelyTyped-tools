import fetch = require("node-fetch");
import { settings } from "./common";
import { currentTimeStamp, indent } from "./util";

export async function setIssueOk(githubAccessToken: string): Promise<void> {
	await doUpdate(githubAccessToken, `Server has been up as of **${currentTimeStamp()}**`);
}

export async function reopenIssue(githubAccessToken: string, timeStamp: string, error: Error): Promise<void> {
	await doUpdate(githubAccessToken, createContent());

	function createContent(): string {
		const lines: string[] = [];
		const l = lines.push.bind(lines);
		l(`### There was a server error on **${timeStamp}**.`);
		l("The types-publisher server has shut down.");
		l("Please fix the issue and restart the server. The server will update this issue.");
		l("");
		const url = `https://${settings.azureContainer}.blob.core.windows.net/${settings.azureContainer}/index.html`;
		l(`Logs are available [here](${url}).`);
		l("");
		l(indent(error.stack));
		return lines.join("\n");
	}
}

async function doUpdate(accessToken: string, body: string): Promise<void> {
	const url = `https://api.github.com/repos/${settings.errorsIssue}?access_token=${accessToken}`;
	const message = { body, state: "open" };
	const response = await fetch(url, { method: "PATCH", body: JSON.stringify(message) });
	const responseBody = await response.json();
	if (responseBody.body !== body) {
		throw new Error(JSON.stringify(responseBody, undefined, 4));
	}
}

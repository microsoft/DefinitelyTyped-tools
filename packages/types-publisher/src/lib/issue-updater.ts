import { fetchJson } from "../util/io";
import { currentTimeStamp, errorDetails, indent } from "../util/util";

import { azureContainer, errorsIssue } from "./settings";

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
		const url = `https://${azureContainer}.blob.core.windows.net/${azureContainer}/index.html`;
		l(`Logs are available [here](${url}).`);
		l("");
		l(indent(errorDetails(error)));
		return lines.join("\n");
	}
}

async function doUpdate(accessToken: string, body: string): Promise<void> {
	const url = `https://api.github.com/repos/${errorsIssue}?access_token=${accessToken}`;
	const message = { body, state: "open" };
	const responseBody = (await fetchJson(url, { method: "PATCH", body: JSON.stringify(message) })) as { body: string };
	if (responseBody.body !== body) {
		throw new Error(JSON.stringify(responseBody, undefined, 4));
	}
}

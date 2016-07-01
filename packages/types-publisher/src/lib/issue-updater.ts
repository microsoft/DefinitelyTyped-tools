import fetch = require("node-fetch");
import { settings } from "./common";

export default async function updateIssue(githubAccessToken: string, timeStamp: string, dataUrls: string[], logUrls: string[]): Promise<void> {
	const content = createIssueContent(timeStamp, dataUrls, logUrls);
	await doUpdate(settings.logsIssue, githubAccessToken, content);
};

async function doUpdate(issue: string, accessToken: string, newIssueContent: string): Promise<void> {
	const url = `https://api.github.com/repos/${issue}?access_token=${accessToken}`;
	const body = JSON.stringify({ body: newIssueContent });
	const response = await fetch(url, { method: "PATCH", body });
	const responseBody = await response.json();
	if (responseBody.body !== newIssueContent) {
		throw new Error(JSON.stringify(responseBody, undefined, 4));
	}
}

function createIssueContent(timeStamp: string, dataUrls: string[], logUrls: string[]): string {
	const lines: string[] = [];
	lines.push(`Here is the latest data as of **${timeStamp}**:`);
	lines.push("");
	lines.push(`### Data`);
	lines.push(...dataUrls.map(link));
	lines.push("");
	lines.push(`### Logs`);
	lines.push(...logUrls.map(link));
	return lines.join("\n");

	function link(url: string): string {
		const short = url.slice(url.lastIndexOf("/") + 1);
		return `* [${short}](${url})`;
	}
}

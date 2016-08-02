import * as yargs from "yargs";
import server from "./lib/webhook-server";
import { setIssueOk } from "./lib/issue-updater";

if (!module.parent) {
	main().catch(console.error);
}

export default async function main(): Promise<void> {
	const key = process.env["GITHUB_SECRET"];
	const githubAccessToken = process.env["GITHUB_ACCESS_TOKEN"];
	const dry = !!(yargs.argv.dry || process.env["WEBHOOK_FORCE_DRY"]);
	const port = process.env["PORT"];

	if (!(key && githubAccessToken && port)) {
		console.log("The environment variables GITHUB_SECRET and GITHUB_ACCESS_TOKEN and PORT must be set.");
	}
	else {
		console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
		const s = await server(key, githubAccessToken, dry);
		await setIssueOk(githubAccessToken);
		console.log(`Listening on port ${port}`);
		s.listen(port);
	}
}

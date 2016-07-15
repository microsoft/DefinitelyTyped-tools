import * as yargs from "yargs";
import { settings } from "./lib/common";
import server from "./lib/webhook-server";
import { checkLoggedIn } from "./publish-packages";
import { setIssueOk } from "./lib/issue-updater";

if (!module.parent) {
	const key = process.env["GITHUB_SECRET"];
	const githubAccessToken = process.env["GITHUB_ACCESS_TOKEN"];
	const dry = yargs.argv.dry || process.env["WEBHOOK_FORCE_DRY"];
	const port = settings.webhookPort;

	if (!(key && githubAccessToken)) {
		console.log("The environment variables GITHUB_SECRET and GITHUB_ACCESS_TOKEN must be set.");
	}
	else {
		checkLoggedIn();
		const s = server(key, githubAccessToken, dry);
		setIssueOk(githubAccessToken);
		console.log(`Listening on port ${port}`);
		s.listen(port);
	}
}

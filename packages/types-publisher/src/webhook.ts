import * as yargs from "yargs";

import { Options } from "./lib/common";
import { setIssueOk } from "./lib/issue-updater";
import { getSecret, Secret } from "./lib/secrets";
import server from "./lib/webhook-server";
import { done } from "./util/util";

if (!module.parent) {
	done(main());
}

export default async function main(): Promise<void> {
	const key = await getSecret(Secret.GITHUB_SECRET);
	const githubAccessToken = await getSecret(Secret.GITHUB_ACCESS_TOKEN);
	const dry = !!(yargs.argv.dry || process.env.WEBHOOK_FORCE_DRY);
	const port = process.env.PORT;

	if (!(key && githubAccessToken && port)) {
		console.log("The environment variables GITHUB_SECRET and GITHUB_ACCESS_TOKEN and PORT must be set.");
	}
	else {
		console.log(`=== ${dry ? "DRY" : "PRODUCTION"} RUN ===`);
		const s = await server(key, githubAccessToken, dry, Options.azure);
		await setIssueOk(githubAccessToken);
		console.log(`Listening on port ${port}`);
		s.listen(port);
	}
}

import * as yargs from "yargs";
import { settings } from "./lib/common";
import server from "./lib/webhook-server";
import { checkLoggedIn } from "./publish-packages";

if (!module.parent) {
	const key = process.env["GITHUB_SECRET"];
	const dry = yargs.argv.dry || process.env["WEBHOOK_FORCE_DRY"];
	const port = settings.webhookPort;

	if (!key) {
		console.log("The environment variable GITHUB_SECRET must be set.");
	}
	else {
		checkLoggedIn();
		console.log(`Listening on port ${port}`);
		server(key, dry).listen(port);
	}
}

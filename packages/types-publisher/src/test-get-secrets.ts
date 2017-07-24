// Run `node ./bin/test-get-secrets.js` to test that we can fetch secrets from Azure Keyvault

import { allSecrets, getSecret, Secret } from "./lib/secrets";
import { done } from "./util/util";

if (!module.parent) {
	done(main());
}

async function main(): Promise<void> {
	for (const secret of allSecrets) {
		console.log(`Fetching secret '${Secret[secret]}'...`);
		console.log(await getSecret(secret));
	}
}

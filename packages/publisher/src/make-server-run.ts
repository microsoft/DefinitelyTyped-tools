import * as yargs from "yargs";
import { logUncaughtErrors, makeHttpRequest } from "@definitelytyped/utils";
import { getSecret, Secret } from "./lib/secrets";
import { sourceBranch } from "./lib/settings";
import { expectedSignature } from "./lib/webhook-server";

if (!module.parent) {
    const remote = yargs.argv.remote;
    logUncaughtErrors(main(remote ? { hostname: "typespublisher.azurewebsites.net" }  : { hostname: "localhost", port: getPort() }));
}

function getPort(): number {
    const port = parseInt(process.env.PORT!, 10);
    if (!port) {
        throw new Error("Must provide PORT");
    }
    return port;
}

async function main(options: { hostname: string, port?: number }): Promise<void> {
    const key = await getSecret(Secret.GITHUB_SECRET);
    const body = JSON.stringify({ ref: `refs/heads/${sourceBranch}` });
    console.log(await makeHttpRequest({
        hostname: options.hostname,
        port: options.port,
        path: "",
        method: "POST",
        body,
        headers: { "x-hub-signature": expectedSignature(key, body) },
    }));
}

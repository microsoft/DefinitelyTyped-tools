import { Fetcher } from "../util/io";
import { currentTimeStamp, errorDetails, indent } from "../util/util";

import { azureContainer, errorsIssue } from "./settings";

export async function setIssueOk(githubAccessToken: string, fetcher: Fetcher): Promise<void> {
    await doUpdate(githubAccessToken, `Server has been up as of **${currentTimeStamp()}**`, fetcher);
}

export async function reopenIssue(githubAccessToken: string, timeStamp: string, error: Error, fetcher: Fetcher): Promise<void> {
    const content = [
        `### There was a server error on **${timeStamp}**.`,
        "The types-publisher server has shut down.",
        "Please fix the issue and restart the server. The server will update this issue.",
        "",
        `Logs are available [here](https://${azureContainer}.blob.core.windows.net/${azureContainer}/index.html).`,
        "",
        indent(errorDetails(error)),
    ].join("\n");
    await doUpdate(githubAccessToken, content, fetcher);
}

async function doUpdate(accessToken: string, body: string, fetcher: Fetcher): Promise<void> {
    const message = { body, state: "open" };
    const responseBody = await fetcher.fetchJson({
        hostname: "api.github.com",
        path: `repos/${errorsIssue}?access_token=${accessToken}`,
        body: JSON.stringify(message),
        method: "PATCH",
        headers: {
            // arbitrary string, but something must be provided
            "User-Agent": "types-publisher",
        },
    }) as { body: string };
    if (responseBody.body !== body) {
        throw new Error(JSON.stringify(responseBody, undefined, 4));
    }
}

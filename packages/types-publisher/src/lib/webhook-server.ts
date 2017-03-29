import { createHmac, timingSafeEqual } from "crypto";
import { createServer, IncomingMessage, Server, ServerResponse } from "http";

import full from "../full";
import { stringOfStream } from "../util/io";
import { joinLogWithErrors, LoggerWithErrors, loggerWithErrors, LogWithErrors } from "../util/logging";
import { currentTimeStamp, errorDetails, parseJson } from "../util/util";

import { Options } from "./common";
import { reopenIssue } from "./issue-updater";
import NpmClient from "./npm-client";
import RollingLogs from "./rolling-logs";
import { sourceBranch } from "./settings";

export default async function server(key: string, githubAccessToken: string, dry: boolean, options: Options): Promise<Server> {
	const client = await NpmClient.create();
	return listenToGithub(key, githubAccessToken, dry, updateOneAtATime(async (log, timeStamp) => {
		log.info(""); log.info("");
		log.info(`# ${timeStamp}`);
		log.info("");
		log.info("Starting full...");
		await full(client, dry, timeStamp, options);
	}));
}

function writeLog(rollingLogs: RollingLogs, logs: LogWithErrors): Promise<void> {
	return rollingLogs.write(joinLogWithErrors(logs));
}

function webResult(dry: boolean, timeStamp: string): string {
	// tslint:disable:max-line-length
	return `
<html>
<head></head>
<body>
	This is the TypeScript types-publisher webhook server.<br/>
	If you can read this, the webhook is running. (Dry mode: <strong>${dry}</strong>)<br/>
	Latest deploy was on <strong>${timeStamp}</strong>.
	You probably meant to see:
	<ul>
		<li><a href="https://typespublisher.blob.core.windows.net/typespublisher/index.html">Latest data</a></li>
		<li><a href="https://github.com/Microsoft/types-publisher">GitHub</a></li>
		<li><a href="https://github.com/Microsoft/types-publisher/issues/40">Server status issue</a></li>
		<li><a href="https://ms.portal.azure.com/?resourceMenuPerf=true#resource/subscriptions/99160d5b-9289-4b66-8074-ed268e739e8e/resourceGroups/Default-Web-WestUS/providers/Microsoft.Web/sites/types-publisher/App%20Services">Azure account (must have permission)</a></li>
	</ul>
</body>
</html>
`;
	// tslint:enable:max-line-length
}

/** @param onUpdate: returns a promise in case it may error. Server will shut down on errors. */
function listenToGithub(
	key: string, githubAccessToken: string, dry: boolean,
	onUpdate: (log: LoggerWithErrors, timeStamp: string) => Promise<void> | undefined): Server {

	const rollingLogs = RollingLogs.create("webhook-logs.md", 1000);
	const webText = webResult(dry, currentTimeStamp());
	const server = createServer((req, resp) => {
		switch (req.method) {
			case "GET":
				resp.write(webText);
				resp.end();
				break;
			case "POST":
				receiveUpdate(req, resp);
				break;
			default:
				// Don't respond
		}
	});
	return server;

	function receiveUpdate(req: IncomingMessage, resp: ServerResponse): void {
		const [log, logResult] = loggerWithErrors();
		const timeStamp = currentTimeStamp();
		try {
			work().then(() => rollingLogs.then(logs => writeLog(logs, logResult()))).catch(onError);
		} catch (error) {
			rollingLogs.then(logs => writeLog(logs, logResult())).then(() => onError(error)).catch(onError);
		}

		function onError(error: Error): void {
			server.close();
			reopenIssue(githubAccessToken, timeStamp, error).catch(issueError => {
				console.error(errorDetails(issueError));
			}).then(() => {
				console.error(errorDetails(error));
				process.exit(1);
			});
		}

		async function work(): Promise<void> {
			const data = await stringOfStream(req);
			if (!checkSignature(key, data, req.headers, log)) {
				return;
			}

			log.info(`Message from github: ${data}`);
			const expectedRef = `refs/heads/${sourceBranch}`;

			const actualRef = parseJson(data).ref;
			if (actualRef === expectedRef) {
				respond("Thanks for the update! Running full.");
				await onUpdate(log, timeStamp);
			}
			else {
				const text = `Ignoring push to ${actualRef}, expected ${expectedRef}.`;
				respond(text);
				log.info(text);
			}
		}

		// This is for the benefit of `npm run make-[production-]server-run`. GitHub ignores this.
		function respond(text: string): void {
			resp.write(text);
			resp.end();
		}
	}
}

// Even if there are many changes to DefinitelyTyped in a row, we only perform one update at a time.
function updateOneAtATime(doOnce: (log: LoggerWithErrors, timeStamp: string) => Promise<void>
	): (log: LoggerWithErrors, timeStamp: string) => Promise<void> | undefined {

	let working = false;
	let anyUpdatesWhileWorking = false;

	return (log, timeStamp) => {
		if (working) {
			anyUpdatesWhileWorking = true;
			log.info(`Not starting update, because already performing one.`);
			return undefined;
		}
		else {
			working = false;
			anyUpdatesWhileWorking = false;
			return work();
		}

		async function work(): Promise<void> {
			log.info(`Starting update`);
			working = true;
			anyUpdatesWhileWorking = false;
			do {
				await doOnce(log, timeStamp);
				working = false;
			} while (anyUpdatesWhileWorking);
		}
	};
}

function checkSignature(key: string, data: string, headers: any, log: LoggerWithErrors): boolean {
	const signature = headers["x-hub-signature"];
	const expected = expectedSignature(key, data);
	if (stringEqualsConstantTime(signature, expected)) {
		return true;
	}

	log.error(`Invalid request: expected ${expected}, got ${signature}`);
	log.error(`Headers are: ${JSON.stringify(headers, undefined, 4)}`);
	log.error(`Data is: ${data}`);
	log.error("");
	return false;
}

// Use a constant-time compare to prevent timing attacks
function stringEqualsConstantTime(actual: string, expected: string): boolean {
	// `timingSafeEqual` throws if they don't have the same length.
	const actualBuffer = new Buffer(expected.length);
	actualBuffer.write(actual);
	return timingSafeEqual(actualBuffer, new Buffer(expected));
}

export function expectedSignature(key: string, data: string): string {
	const hmac = createHmac("sha1", key);
	hmac.write(data);
	const digest = hmac.digest("hex");
	return `sha1=${digest}`;
}

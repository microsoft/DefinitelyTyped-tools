import assert = require("assert");
import bufferEqualsConstantTime = require("buffer-equals-constant");
import { createHmac } from "crypto";
import { createServer, Server } from "http";
import full from "../full";
import RollingLogs from "./rolling-logs";
import { ArrayLog, settings } from "./common";
import { currentTimeStamp, indent, parseJson } from "./util";

const rollingLogs = new RollingLogs("webhook-logs.md", 1000);

export default function server(key: string, dry: boolean): Server {
	return listenToGithub(key, dry, updateOneAtATime(async (log, timeStamp) => {
		log.info(""); log.info("");
		log.info(`# ${timeStamp}`);
		log.info("");
		log.info("Starting full...");
		try {
			await full(dry, timeStamp);
		} catch (err) {
			log.info("# ERRROR");
			log.info("");
			log.info(indent(err.stack));
		}

		if (!dry) {
			await writeLog(log);
		}
	}));
}

function writeLog(log: ArrayLog): Promise<void> {
	const { infos, errors } = log.result();
	assert(!errors.length);
	return rollingLogs.write(infos);
}

function listenToGithub(key: string, dry: boolean, onUpdate: (log: ArrayLog, timeStamp: string) => void): Server {
	return createServer(req => {
		req.on("data", (data: string) => {
			const log = new ArrayLog(true);
			const timeStamp = currentTimeStamp();

			if (!checkSignature(key, data, req.headers["x-hub-signature"])) {
				log.error(`Request does not have the correct x-hub-signature: headers are ${JSON.stringify(req.headers, undefined, 4)}`);
				return;
			}

			log.info(`Message from github: ${data}`);
			const expectedRef = `refs/heads/${settings.sourceBranch}`;

			try {
				const actualRef = parseJson(data).ref;
				if (actualRef === expectedRef) {
					onUpdate(log, timeStamp);
					return;
				}
				else {
					log.info(`Ignoring push to ${actualRef}, expected ${expectedRef}.`);
				}
			} catch (err) {
				log.info(err.stack);
			}
			writeLog(log);
		});
	});
}

// Even if there are many changes to DefinitelyTyped in a row, we only perform one update at a time.
function updateOneAtATime(doOnce: (log: ArrayLog, timeStamp: string) => Promise<void>): (log: ArrayLog, timeStamp: string) => void {
	let working = false;
	let anyUpdatesWhileWorking = false;

	return (log, timeStamp) => {
		if (working) {
			anyUpdatesWhileWorking = true;
			log.info(`Not starting update, because already performing one.`);
		}
		else {
			working = false;
			anyUpdatesWhileWorking = false;
			work().catch(console.error);
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

function checkSignature(key: string, data: string, actualSignature: string) {
	const expectedSignature = `sha1=${getDigest()}`;
	// Prevent timing attacks
	return stringEqualsConstantTime(expectedSignature, actualSignature);

	function getDigest(): string {
		const hmac = createHmac("sha1", key);
		hmac.write(data);
		return hmac.digest("hex");
	}

	function stringEqualsConstantTime(s1: string, s2: string): boolean {
		return bufferEqualsConstantTime(new Buffer(s1), new Buffer(s2));
	}
}

import fetch = require("node-fetch");
import * as container from "./azure-container";

export default class RollingLogs {
	private allLogs: string[] | undefined;

	constructor(public name: string, public maxLines: number) {}

	async write(lines: string[]): Promise<void> {
		const logs = this.allLogs || (this.allLogs = await this.readAllLogs());
		const totalLines = logs.length + lines.length;
		logs.splice(0, totalLines - this.maxLines);
		logs.push(...lines);
		await container.createBlobFromText(this.name, logs.join("\n"));
	}

	private async readAllLogs(): Promise<string[]> {
		const response = await fetch(container.urlOfBlob(this.name));
		if (response.status === 404) {
			return [];
		}
		else {
			const responseText = await response.text();
			return responseText.split("\n");
		}
	}
}

import { createBlobFromText, readBlob } from "./azure-container";

export default class RollingLogs {
	private allLogs: string[] | undefined;

	constructor(public name: string, public maxLines: number) {}

	async write(lines: string[]): Promise<void> {
		const logs = this.allLogs || (this.allLogs = await this.readAllLogs());
		const totalLines = logs.length + lines.length;
		logs.splice(0, totalLines - this.maxLines);
		logs.push(...lines);
		await createBlobFromText(this.name, logs.join("\n"));
	}

	private async readAllLogs(): Promise<string[]> {
		try {
			return (await readBlob(this.name)).split("\n");
		}
		catch (err) {
			// 404
			return [];
		}
	}
}

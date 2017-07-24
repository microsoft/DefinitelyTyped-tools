import BlobWriter, { readBlob } from "./azure-container";

export default class RollingLogs {
	static async create(name: string, maxLines: number): Promise<RollingLogs> {
		return new RollingLogs(name, maxLines, await BlobWriter.create());
	}

	private allLogs: string[] | undefined;

	constructor(public name: string, public maxLines: number, private container: BlobWriter) {}

	async write(lines: string[]): Promise<void> {
		const logs = this.allLogs || (this.allLogs = await this.readAllLogs());
		const totalLines = logs.length + lines.length;
		logs.splice(0, totalLines - this.maxLines);
		logs.push(...lines);
		await this.container.createBlobFromText(this.name, logs.join("\n"));
	}

	private async readAllLogs(): Promise<string[]> {
		try {
			return (await readBlob(this.name)).split("\n");
		} catch (err) {
			// 404
			return [];
		}
	}
}

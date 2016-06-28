declare module "fs-promise" {
	export function writeFile(path: string, content: string, options: { encoding: "utf8" }): Promise<void>;
	export function readFile(path: string, options: { encoding: "utf8" }): Promise<string>
	export function mkdirp(path: string): Promise<void>
	export function readdir(dirPath: string): Promise<string[]>
	export function unlink(path: string): Promise<void>
	export function stat(path: string): Promise<{ isDirectory(): boolean }>
}

import { readFile } from "fs-extra";
import stripJsonComments from "strip-json-comments";

export async function readJsonWithComments(path: string) {
    const text = await readFile(path, "utf-8");
    return JSON.parse(stripJsonComments(text));
}

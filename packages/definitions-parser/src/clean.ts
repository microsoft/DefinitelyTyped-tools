import fs from "fs";
import { dataDirPath } from "./lib/settings";

export function clean() {
  fs.rmSync(dataDirPath, { recursive: true, force: true });
}

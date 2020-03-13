import { removeSync } from "fs-extra";
import { dataDirPath } from "./lib/settings";

export function clean() {
  removeSync(dataDirPath);
}

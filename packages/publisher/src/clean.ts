import { clean as cleanParser } from "@definitelytyped/definitions-parser";
import { cleanLogDirectory } from "@definitelytyped/utils";
import { removeSync } from "fs-extra";
import { outputDirPath, validateOutputPath } from "./lib/settings";

if (module.filename === process.argv[1]) {
  clean();
}

export function clean() {
  cleanParser();
  cleanLogDirectory();
  removeSync(outputDirPath);
  removeSync(validateOutputPath);
}

import { clean as cleanParser } from "@definitelytyped/definitions-parser";
import { cleanLogDirectory } from "@definitelytyped/utils";
import fs from "fs";
import { outputDirPath, validateOutputPath } from "./lib/settings";

if (require.main === module) {
  clean();
}

export function clean() {
  cleanParser();
  cleanLogDirectory();
  fs.rmSync(outputDirPath, { recursive: true, force: true });
  fs.rmSync(validateOutputPath, { recursive: true, force: true });
}

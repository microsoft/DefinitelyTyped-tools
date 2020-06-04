import * as os from "os";
import { joinPaths } from "@definitelytyped/utils";
import { AnyPackage } from "@definitelytyped/definitions-parser";
import { outputDirPath } from "../lib/settings";

export function currentTimeStamp(): string {
  return new Date().toISOString();
}

export function outputDirectory(pkg: AnyPackage) {
  return joinPaths(outputDirPath, pkg.desc);
}

export const numberOfOsProcesses = os.cpus().length;

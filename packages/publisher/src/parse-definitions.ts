import os from "os";
import yargs from "yargs";
import { logUncaughtErrors, loggerWithErrors, assertDefined, FS } from "@definitelytyped/utils";
import { defaultLocalOptions } from "./lib/common";
import { getTypingInfo } from "@definitelytyped/definitions-parser/dist/lib/definition-parser";
import {
  getDefinitelyTyped,
  parseDefinitions,
  writeDataFile,
  typesDataFilename
} from "@definitelytyped/definitions-parser";

if (!module.parent) {
  const { nProcesses, single: singleName } = yargs.options({
    single: { type: "string" },
    nProcesses: { type: "number" }
  }).argv;

  const options = defaultLocalOptions;
  logUncaughtErrors(async () => {
    const log = loggerWithErrors()[0];
    const dt = await getDefinitelyTyped(options, log);
    if (singleName) {
      await single(singleName, dt);
    } else {
      await parseDefinitions(
        dt,
        options.parseInParallel
          ? {
              nProcesses: nProcesses || os.cpus().length,
              definitelyTypedPath: assertDefined(options.definitelyTypedPath)
            }
          : undefined,
        log
      );
    }
  });
}

async function single(singleName: string, dt: FS): Promise<void> {
  const data = await getTypingInfo(singleName, dt.subDir("types").subDir(singleName));
  const typings = { [singleName]: data };
  await writeDataFile(typesDataFilename, typings);
  console.log(JSON.stringify(data, undefined, 4));
}

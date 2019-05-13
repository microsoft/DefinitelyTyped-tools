import * as os from 'os';
import { AllPackages, typesDataFilename } from 'types-publisher/bin/lib/packages';
import { FS, getLocallyInstalledDefinitelyTyped } from 'types-publisher/bin/get-definitely-typed';
import { consoleLogger } from 'types-publisher/bin/util/logging';
import { pathExists } from '../common';
import { dataFilePath } from 'types-publisher/bin/lib/common';
import parseDefinitions from 'types-publisher/bin/parse-definitions';

export async function getParsedPackages(definitelyTypedPath: string): Promise<{
  definitelyTypedFS: FS;
  allPackages: AllPackages;
}> {
  const definitelyTypedFS = getLocallyInstalledDefinitelyTyped(definitelyTypedPath);
  const isDebugging = process.execArgv.some(arg => arg.startsWith('--inspect'));
  if (process.env.NODE_ENV === 'production' || !(await pathExists(dataFilePath(typesDataFilename)))) {
    await parseDefinitions(definitelyTypedFS, isDebugging ? undefined : {
      definitelyTypedPath,
      nProcesses: os.cpus().length,
    }, consoleLogger);
  }
  const allPackages = await AllPackages.read(definitelyTypedFS);
  return { definitelyTypedFS, allPackages };
}
import { deserializeArgs } from '../common';
import { benchmarkPackage } from './benchmarkPackage';
import { getPackagesToBenchmark } from './getPackagesToBenchmark';

if (!module.parent) {
  const entry = process.argv[2];
  const args = deserializeArgs(process.argv.slice(3));
  (async () => {
    try {
      switch (entry) {
        case 'benchmarkPackage':
          return benchmarkPackage(args);
        case 'getPackagesToBenchmark':
          return getPackagesToBenchmark(args);
        default:
          console.error(`Unrecognized entry '${entry}'`);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();

  process.on('unhandledRejection', err => {
    console.error(err);
    process.exit(1);
  });
}

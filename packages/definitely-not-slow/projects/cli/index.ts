import { deserializeArgs } from '../common';
import { benchmarkPackage } from './benchmarkPackage';

if (!module.parent) {
  const entry = process.argv[2];
  const args = deserializeArgs(process.argv.slice(3));
  (async () => {
    try {
      switch (entry) {
        case 'benchmarkPackage':
          return benchmarkPackage(args);
      }
    } catch (err) {
      console.error(err.stack);
      process.exit(1);
    }
  })();

  process.on('unhandledRejection', err => {
    console.error(err);
    process.exit(1);
  });
}

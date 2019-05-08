import { deserializeArgs } from '../common';

if (!module.parent) {
  const args = deserializeArgs(process.argv);
}

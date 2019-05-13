import * as os from 'os';
import { FormatDiagnosticsHost } from 'typescript';

export const formatDiagnosticsHost: FormatDiagnosticsHost = {
  getCanonicalFileName: fileName => fileName,
  getNewLine: () => os.EOL,
  getCurrentDirectory: () => process.cwd(),
};

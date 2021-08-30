import { existsSync, readFileSync } from "fs";
import { dirname, resolve as resolvePath } from "path";
import * as TsType from "typescript";

const programCache = new WeakMap<TsType.Program, Map<string, TsType.Program>>();

/** Maps a Program to one created with the version specified in `options`. */
export function getProgram(configFile: string, ts: typeof TsType, versionName: string, lintProgram: TsType.Program): TsType.Program {
    let versionToProgram = programCache.get(lintProgram);
    if (versionToProgram === undefined) {
        versionToProgram = new Map<string, TsType.Program>();
        programCache.set(lintProgram, versionToProgram);
    }

    let newProgram = versionToProgram.get(versionName);
    if (newProgram === undefined) {
        newProgram = createProgram(configFile, ts);
        versionToProgram.set(versionName, newProgram);
    }
    return newProgram;
}

function createProgram(configFile: string, ts: typeof TsType): TsType.Program {
    const projectDirectory = dirname(configFile);
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
    const parseConfigHost: TsType.ParseConfigHost = {
        fileExists: existsSync,
        readDirectory: ts.sys.readDirectory,
        readFile: file => readFileSync(file, "utf8"),
        useCaseSensitiveFileNames: true,
    };
    const parsed = ts.parseJsonConfigFileContent(config, parseConfigHost, resolvePath(projectDirectory), { noEmit: true });
    const host = ts.createCompilerHost(parsed.options, true);
    return ts.createProgram(parsed.fileNames, parsed.options, host);
}

import { CompilerOptions } from "typescript";
import { formatDiagnosticsHost } from "./formatDiagnosticsHost";
import { PackageBenchmark } from "../common";

export const measureBatchCompilationWorkerFilename = __filename;

export interface MeasureBatchCompilationChildProcessArgs {
  tsPath: string;
  fileNames: string[];
  options: CompilerOptions;
}

export type MeasureBatchCompilationChildProcessResult = Pick<
  PackageBenchmark,
  "typeCount" | "relationCacheSizes" | "memoryUsage"
>;

if (!module.parent) {
  if (!process.send) {
    throw new Error("Process was not started as a forked process");
  }

  process.on("message", async ([message]: MeasureBatchCompilationChildProcessArgs[]) => {
    const ts: typeof import("typescript") = await import(message.tsPath);
    const program = ts.createProgram({ rootNames: message.fileNames, options: message.options });
    const diagnostics = program.getSemanticDiagnostics().filter(diagnostic => {
      return diagnostic.code === 2307; // Cannot find module
    });
    if (diagnostics.length) {
      console.log(ts.formatDiagnostics(diagnostics, formatDiagnosticsHost));
      throw new Error("Compilation had errors");
    }

    const result: MeasureBatchCompilationChildProcessResult = {
      typeCount: (program as any).getTypeCount(),
      memoryUsage: ts.sys.getMemoryUsage!(),
      relationCacheSizes: (program as any).getRelationCacheSizes && (program as any).getRelationCacheSizes()
    };

    process.send!(result);
  });

  process.on("unhandledRejection", err => {
    console.error(err);
    process.exit(1);
  });
}

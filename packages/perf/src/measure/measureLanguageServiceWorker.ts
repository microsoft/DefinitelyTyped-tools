import * as assert from "assert";
import { PerformanceObserver, performance } from "perf_hooks";
import { Omit, LanguageServiceSingleMeasurement } from "../common";
import { getParsedCommandLineForPackage } from "./getParsedCommandLineForPackage";
import { createLanguageServiceHost } from "./createLanguageServiceHost";
import { LanguageService, ParsedCommandLine, LanguageServiceHost } from "typescript";
export const measureLanguageServiceWorkerFilename = __filename;

export interface MeasureLanguageServiceArgs
  extends Omit<LanguageServiceSingleMeasurement, "quickInfoDuration" | "completionsDuration"> {
  packageDirectory: string;
}

export interface MeasureLanguageServiceChildProcessArgs extends MeasureLanguageServiceArgs {
  tsPath: string;
  [key: string]: any;
}

function isMeasureLanguageServiceArgs(_: any): _ is MeasureLanguageServiceChildProcessArgs {
  return true; // Whatever
}

if (!module.parent) {
  if (!process.send) {
    throw new Error("Process was not started as a forked process");
  }

  let ts: typeof import("typescript") | undefined;
  let commandLine: ParsedCommandLine | undefined;
  let languageServiceHost: LanguageServiceHost | undefined;
  let languageService: LanguageService | undefined;

  process.on("message", async (message: unknown) => {
    if (isMeasureLanguageServiceArgs(message)) {
      if (!ts || !commandLine || !languageServiceHost || !languageService) {
        ts = (await import(message.tsPath)) as typeof import("typescript");
        commandLine = getParsedCommandLineForPackage(ts, message.packageDirectory);
        languageServiceHost = createLanguageServiceHost(ts, commandLine.options, commandLine.fileNames);
        languageService = ts.createLanguageService(languageServiceHost);
        // Warm up - make sure functions are compiled
        getCompletionsAtPosition(languageService, message.fileName, message.start);
        getQuickInfoAtPosition(languageService, message.fileName, message.start);
      }

      const positionMeasurement = await measureLanguageService(languageService, message);
      process.send!(positionMeasurement);
    } else {
      throw new Error("Invalid command-line arguments");
    }
  });

  process.on("unhandledRejection", err => {
    console.error(err);
    process.exit(1);
  });
}

async function measureLanguageService(
  languageService: LanguageService,
  args: MeasureLanguageServiceArgs
): Promise<LanguageServiceSingleMeasurement> {
  return {
    fileName: args.fileName,
    start: args.start,
    ...(await measureAtPosition(args.fileName, args.start))
  };

  async function measureAtPosition(
    fileName: string,
    position: number
  ): Promise<Pick<LanguageServiceSingleMeasurement, "quickInfoDuration" | "completionsDuration">> {
    let quickInfoDuration = NaN;
    let completionsDuration = NaN;
    const observer = new PerformanceObserver(list => {
      const completionsMeasurement = list.getEntriesByName("completionsMeasurement")[0];
      const quickInfoMeasurement = list.getEntriesByName("quickInfoMeasurement")[0];
      if (completionsMeasurement) {
        completionsDuration = completionsMeasurement.duration;
      }
      if (quickInfoMeasurement) {
        quickInfoDuration = quickInfoMeasurement.duration;
      }
    });

    observer.observe({ entryTypes: ["measure"] });
    getCompletionsAtPosition(languageService, fileName, position);
    getQuickInfoAtPosition(languageService, fileName, position);
    // Node 16 changed the PerformanceObserver callback to happen async,
    // so we have to sit here and wait for it...
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(!isNaN(quickInfoDuration), "No measurement was recorded for quick info");
    assert.ok(!isNaN(completionsDuration), "No measurement was recorded for completions");
    observer.disconnect();

    return {
      quickInfoDuration,
      completionsDuration
    };
  }
}

function getCompletionsAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
  performance.mark("beforeCompletions");
  const completions = languageService.getCompletionsAtPosition(fileName, pos, undefined);
  performance.mark("afterCompletions");
  performance.measure("completionsMeasurement", "beforeCompletions", "afterCompletions");
  return !!completions && completions.entries.length > 0;
}

function getQuickInfoAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
  performance.mark("beforeQuickInfo");
  const quickInfo = languageService.getQuickInfoAtPosition(fileName, pos);
  performance.mark("afterQuickInfo");
  performance.measure("quickInfoMeasurement", "beforeQuickInfo", "afterQuickInfo");
  return !!quickInfo;
}

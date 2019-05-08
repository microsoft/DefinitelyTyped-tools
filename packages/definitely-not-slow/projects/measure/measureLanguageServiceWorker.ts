import { PerformanceObserver, performance } from 'perf_hooks';
import { LanguageServiceMeasurement, LanguageServiceMeasurementTarget, Omit } from '../common';
import { getParsedCommandLineForPackage } from './getParsedCommandLineForPackage';
import { createLanguageServiceHost } from './createLanguageServiceHost';
import { LanguageService, ParsedCommandLine, LanguageServiceHost } from 'typescript';
import { mean, stdDev } from './utils';
export const measureLanguageServiceWorkerFilename = __filename;

export interface MeasureLanguageServiceArgs extends Omit<LanguageServiceMeasurement, 'durations'> {
  packageDirectory: string;
  iterations: number;
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
    throw new Error('Process was not started as a forked process');
  }

  let ts: typeof import('typescript') | undefined;
  let commandLine: ParsedCommandLine | undefined;
  let languageServiceHost: LanguageServiceHost | undefined;
  let languageService: LanguageService | undefined;

  process.on('message', async (message: unknown[]) => {
    for (const args of message) {
      if (isMeasureLanguageServiceArgs(args)) {
        if (!ts || !commandLine || !languageServiceHost || !languageService) {
          ts = await import(args.tsPath) as typeof import('typescript');
          commandLine = getParsedCommandLineForPackage(ts, args.packageDirectory);
          languageServiceHost = createLanguageServiceHost(ts, commandLine.options, commandLine.fileNames);
          languageService = ts.createLanguageService(languageServiceHost);
        }

        const positionMeasurement = await measureLanguageService(languageService, args);
        process.send!(positionMeasurement);
      } else {
        throw new Error('Invalid command-line arguments');
      }
    }
  });

  process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
  });
}

async function measureLanguageService(languageService: LanguageService, args: MeasureLanguageServiceArgs) {
  const measurements: LanguageServiceMeasurement[] = [];
  if (args.kind & LanguageServiceMeasurementTarget.Completions) {
    measurements.push(measureAtPosition(
      args.fileName,
      args.start,
      args.iterations,
      LanguageServiceMeasurementTarget.Completions));
  }
  if (args.kind & LanguageServiceMeasurementTarget.QuickInfo) {
    measurements.push(measureAtPosition(
      args.fileName,
      args.start,
      args.iterations,
      LanguageServiceMeasurementTarget.QuickInfo));
  }
  return measurements;

  function measureAtPosition(
    fileName: string,
    position: number,
    iterations: number,
    kind: LanguageServiceMeasurementTarget,
) {
    const benchmark: LanguageServiceMeasurement = {
      kind,
      fileName: args.fileName,
      start: position,
      end: args.end,
      line: args.line,
      offset: args.offset,
      identifierText: args.identifierText,
      durations: [],
    };

    const observer = new PerformanceObserver((list, obs) => {
      const measurement = list.getEntriesByName('languageServiceMeasurement')[0];
      benchmark.durations.push(measurement.duration);
      obs.disconnect();
    });

    const measure =
      kind === LanguageServiceMeasurementTarget.Completions ? getCompletionsAtPosition :
      kind === LanguageServiceMeasurementTarget.QuickInfo ? getQuickInfoAtPosition :
      () => { throw new Error(`'kind' must be exactly one 'LanguageServiceMeasurementTarget'`); }
  
    // Warm up
    measure(languageService, fileName, position);

    // v8 will optimize this a lot, so the results might look slightly better
    // than they really are, but the important thing is being consistent with
    // how we measure so that we can compare _relative_ performance between
    // benchmarks.
    for (let i = 0; i < iterations; i++) {
      observer.observe({ entryTypes: ['measure'] });
      measure(languageService, fileName, position);
    }
  
    return benchmark;
  }
}

function getCompletionsAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
  performance.mark('beforeCompletions');
  const completions = languageService.getCompletionsAtPosition(fileName, pos, undefined);
  performance.mark('afterCompletions');
  performance.measure('languageServiceMeasurement', 'beforeCompletions', 'afterCompletions');
  return !!completions && completions.entries.length > 0;
}

function getQuickInfoAtPosition(languageService: LanguageService, fileName: string, pos: number): boolean {
  performance.mark('beforeQuickInfo');
  const quickInfo = languageService.getQuickInfoAtPosition(fileName, pos);
  performance.mark('afterQuickInfo');
  performance.measure('languageServiceMeasurement', 'beforeQuickInfo', 'afterQuickInfo');
  return !!quickInfo;
}
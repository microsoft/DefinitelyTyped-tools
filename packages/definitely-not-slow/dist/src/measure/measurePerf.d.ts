import { FS } from 'types-publisher/bin/get-definitely-typed';
import { AllPackages } from 'types-publisher/bin/lib/packages';
import { PackageBenchmark } from '../common';
export interface MeasurePerfOptions {
    packageName: string;
    packageVersion?: string;
    typeScriptVersion: string;
    definitelyTypedRootPath: string;
    definitelyTypedFS: FS;
    maxLanguageServiceTestPositions?: number;
    progress?: boolean;
    nProcesses: number;
    iterations: number;
    allPackages: AllPackages;
    tsPath: string;
    ts: typeof import('typescript');
    batchRunStart: Date;
}
export declare function measurePerf({ packageName, packageVersion, typeScriptVersion, definitelyTypedRootPath, definitelyTypedFS, allPackages, maxLanguageServiceTestPositions, progress, nProcesses, iterations, tsPath, ts, batchRunStart, }: MeasurePerfOptions): Promise<PackageBenchmark[]>;

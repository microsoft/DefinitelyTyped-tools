import { Args } from '../common';
import { PackageId } from 'types-publisher/bin/lib/packages';
export interface BenchmarkPackageOptions {
    groups?: PackageId[][];
    agentIndex?: number;
    package?: string;
    upload: boolean;
    tsVersion: string;
    progress: boolean;
    iterations: number;
    nProcesses: number;
    maxLanguageServiceTestPositions?: number;
    printSummary: boolean;
    definitelyTypedPath: string;
}
export declare function benchmark(args: Args): Promise<void>;

import { Args } from '../common';
export interface GetPackagesToBenchmarkOptions {
    definitelyTypedPath: string;
    typeScriptVersionMajorMinor: string;
    agentCount: number;
    outFile: string;
}
export declare function getPackagesToBenchmark(args: Args): Promise<void>;

/// <reference types="node" />
import * as fs from 'fs';
export declare const pathExists: typeof fs.exists.__promisify__;
export declare function ensureExists(...pathNames: string[]): string;
export declare function run(cwd: string | undefined, cmd: string): Promise<string | undefined>;
export declare type Args = {
    [key: string]: string | true | number;
};
export declare function deserializeArgs(args: string[]): Args;
export declare function serializeArgs(args: Args): string;
export declare function compact<T>(arr: (T | null | undefined)[]): T[];
export declare function assertString(input: any, name?: string): string;
export declare function assertNumber(input: any, name?: string): number;
export declare function assertBoolean(input: any, name?: string): boolean;
export declare function withDefault<T>(input: T, defaultValue: T): T;

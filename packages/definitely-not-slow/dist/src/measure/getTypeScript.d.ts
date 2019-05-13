export declare function getTypeScript(version: string, localTypeScriptPath?: string): Promise<{
    ts: typeof import('typescript');
    tsPath: string;
}>;

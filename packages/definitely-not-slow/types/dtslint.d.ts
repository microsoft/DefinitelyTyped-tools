declare module 'dtslint/bin/installer' {
  export function installAll(): Promise<void>;
  export function typeScriptPath(version: string, localTypeScriptPath?: string): string;
}

declare module "dtslint/bin/installer" {
  export function installAll(): Promise<void>;
  export function installNext(): Promise<void>;
  export function cleanInstalls(): Promise<void>;
  export function typeScriptPath(version: string, localTypeScriptPath?: string): string;
}

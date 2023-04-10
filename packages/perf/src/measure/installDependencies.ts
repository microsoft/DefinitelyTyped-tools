import { execAndThrowErrors } from "@definitelytyped/utils";

export async function installDependencies(definitelyTypedPath: string): Promise<string> {
  return execAndThrowErrors("pnpm install", definitelyTypedPath);
}

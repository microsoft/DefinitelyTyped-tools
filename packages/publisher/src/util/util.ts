import * as os from "os";

export function currentTimeStamp(): string {
    return new Date().toISOString();
}

export const numberOfOsProcesses = process.env.TRAVIS === "true" ? 2 : os.cpus().length;


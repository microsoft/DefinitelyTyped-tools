import assert = require("assert");
import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as process from "process";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";

export type TsVersion = TypeScriptVersion | "local";

const installsDir = path.join(os.homedir(), ".dts", "typescript-installs");

export async function installAllTypeScriptVersions() {
  for (const v of TypeScriptVersion.shipped) {
    await install(v);
  }
  // `shipped + [rc, next] == supported` during the RC period. During that time, typescript@rc needs to be installed too.
  if (TypeScriptVersion.shipped.length + 2 === TypeScriptVersion.supported.length) {
    await install("rc");
  }
  await installTypeScriptNext();
}

export async function installTypeScriptNext() {
  await install("next");
}

export async function install(version: TsVersion | "next" | "rc"): Promise<void> {
  if (version === "local") {
    return;
  }
  const dir = installDir(version);
  if (!fs.existsSync(dir)) {
    console.log(`Installing to ${dir}...`);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        description: `Installs typescript@${version}`,
        repository: "N/A",
        license: "MIT",
        dependencies: {
          typescript: version,
        },
      }),
    );
    await execAndThrowErrors("npm install --ignore-scripts --no-shrinkwrap --no-package-lock --no-bin-links", dir);
    console.log("Installed!");
    console.log("");
  }
}

export function cleanTypeScriptInstalls(): Promise<void> {
  return fs.promises.rm(installsDir, { recursive: true, force: true });
}

export function typeScriptPath(version: TsVersion | "next" | "rc", tsLocal: string | undefined): string {
  if (version === "local") {
    return tsLocal! + "/typescript.js";
  }
  return path.join(installDir(version), "node_modules", "typescript");
}

function installDir(version: TsVersion | "next" | "rc"): string {
  assert(version !== "local");
  if (version === "next") version = TypeScriptVersion.latest;
  if (version === "rc") version = TypeScriptVersion.supported[TypeScriptVersion.supported.length - 2];
  return path.join(installsDir, version);
}

/** Run a command and return the stdout, or if there was an error, throw. */
async function execAndThrowErrors(cmd: string, cwd?: string): Promise<void> {
  // tslint:disable-next-line:promise-must-complete
  return new Promise<void>((resolve, reject) => {
    const env = { ...process.env };
    if (env.NODE_OPTIONS && env.NODE_OPTIONS.includes("--require")) {
      delete env.NODE_OPTIONS;
    }
    exec(cmd, { encoding: "utf8", cwd, env }, (err, _stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
      }

      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

import assert from "assert";
import { ChildProcess, exec as node_exec, fork, Serializable } from "child_process";
import { Socket } from "net";

const DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE = 4096;
const DEFAULT_CHILD_RESTART_TASK_INTERVAL = 1_000_000;

/** Run a command and return the error, stdout, and stderr. (Never throws.) */
export function exec(
  cmd: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv
): Promise<{ error: Error | undefined; stdout: string; stderr: string }> {
  return new Promise<{ error: Error | undefined; stdout: string; stderr: string }>((resolve) => {
    // Fix "stdout maxBuffer exceeded" error
    // See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/26545#issuecomment-402274021
    const maxBuffer = 1024 * 1024 * 1; // Max = 1 MiB, default is 200 KiB

    node_exec(cmd, { encoding: "utf8", cwd, maxBuffer, env }, (error, stdout, stderr) => {
      resolve({ error: error === null ? undefined : error, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/** Run a command and return the stdout, or if there was an error, throw. */
export async function execAndThrowErrors(cmd: string, cwd?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const { error, stdout, stderr } = await exec(cmd, cwd, env);
  if (error) {
    throw new Error(`${error.stack}\n${stderr}`);
  }
  return stdout;
}

export const enum CrashRecoveryState {
  Normal,
  Retry,
  RetryWithMoreMemory,
  Crashed,
}

interface RunWithListeningChildProcessesOptions<In> {
  readonly inputs: readonly In[];
  readonly commandLineArgs: string[];
  readonly workerFile: string;
  readonly nProcesses: number;
  readonly cwd: string;
  readonly crashRecovery?: boolean;
  readonly crashRecoveryMaxOldSpaceSize?: number;
  readonly childRestartTaskInterval?: number;
  readonly softTimeoutMs?: number;
  handleOutput(output: unknown, processIndex: number | undefined): void;
  handleStart?(input: In, processIndex: number | undefined): void;
  handleCrash?(input: In, state: CrashRecoveryState, processIndex: number | undefined): void;
}
export function runWithListeningChildProcesses<In extends Serializable>({
  inputs,
  commandLineArgs,
  workerFile,
  nProcesses,
  cwd,
  handleOutput,
  crashRecovery,
  crashRecoveryMaxOldSpaceSize = DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE,
  childRestartTaskInterval = DEFAULT_CHILD_RESTART_TASK_INTERVAL,
  handleStart,
  handleCrash,
  softTimeoutMs = Infinity,
}: RunWithListeningChildProcessesOptions<In>): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let inputIndex = 0;
    let processesLeft = nProcesses;
    let tasksSoFar = 0;
    let rejected = false;
    const runningChildren = new Set<ChildProcess>();
    const maxOldSpaceSize = getMaxOldSpaceSize(process.execArgv) || 0;
    const startTime = Date.now();
    for (let i = 0; i < nProcesses; i++) {
      if (inputIndex === inputs.length) {
        processesLeft--;
        continue;
      }

      const processIndex = nProcesses > 1 ? i + 1 : undefined;
      let child: ChildProcess;
      let crashRecoveryState = CrashRecoveryState.Normal;
      let currentInput: In;

      const onMessage = (outputMessage: unknown) => {
        try {
          tasksSoFar++;
          const oldCrashRecoveryState = crashRecoveryState;
          crashRecoveryState = CrashRecoveryState.Normal;
          handleOutput(outputMessage as {}, processIndex);
          if (inputIndex === inputs.length || Date.now() - startTime > softTimeoutMs) {
            stopChild(/*done*/ true);
          } else {
            if (oldCrashRecoveryState !== CrashRecoveryState.Normal) {
              // retry attempt succeeded, restart the child for further tests.
              console.log(`${processIndex}> Restarting...`);
              restartChild(nextTask, process.execArgv);
            } else if (tasksSoFar >= childRestartTaskInterval) {
              // restart the child to avoid memory leaks.
              stopChild(/*done*/ false);
              startChild(nextTask, process.execArgv);
              tasksSoFar = 0;
            } else {
              nextTask();
            }
          }
        } catch (e) {
          onError(e as Error);
        }
      };

      const onClose = async () => {
        if (rejected || !runningChildren.has(child)) {
          return;
        }

        try {
          // treat any unhandled closures of the child as a crash
          if (crashRecovery) {
            switch (crashRecoveryState) {
              case CrashRecoveryState.Normal:
                crashRecoveryState = CrashRecoveryState.Retry;
                break;
              case CrashRecoveryState.Retry:
                // skip crash recovery if we're already passing a value for --max_old_space_size that
                // is >= crashRecoveryMaxOldSpaceSize
                crashRecoveryState =
                  maxOldSpaceSize < crashRecoveryMaxOldSpaceSize
                    ? CrashRecoveryState.RetryWithMoreMemory
                    : (crashRecoveryState = CrashRecoveryState.Crashed);
                break;
              default:
                crashRecoveryState = CrashRecoveryState.Crashed;
            }
          } else {
            crashRecoveryState = CrashRecoveryState.Crashed;
          }

          if (handleCrash) {
            handleCrash(currentInput, crashRecoveryState, processIndex);
          }

          switch (crashRecoveryState) {
            case CrashRecoveryState.Retry:
              await restartChild(resumeTask, process.execArgv);
              break;
            case CrashRecoveryState.RetryWithMoreMemory:
              await restartChild(resumeTask, [
                ...getExecArgvWithoutMaxOldSpaceSize(),
                `--max_old_space_size=${crashRecoveryMaxOldSpaceSize}`,
              ]);
              break;
            case CrashRecoveryState.Crashed:
              crashRecoveryState = CrashRecoveryState.Normal;
              if (inputIndex === inputs.length || Date.now() - startTime > softTimeoutMs) {
                stopChild(/*done*/ true);
              } else {
                await restartChild(nextTask, process.execArgv);
              }
              break;
            default:
              assert.fail(`${processIndex}> Unexpected crashRecoveryState: ${crashRecoveryState}`);
          }
        } catch (e) {
          onError(e as Error);
        }
      };

      const onError = (err?: Error) => {
        child.removeAllListeners();
        runningChildren.delete(child);
        fail(err);
      };

      const startChild = async (taskAction: () => void, execArgv: string[]) => {
        try {
          child = fork(workerFile, commandLineArgs, { cwd, execArgv: await getChildProcessExecArgv(i, execArgv) });
          runningChildren.add(child);
        } catch (e) {
          fail(e as Error);
          return;
        }

        try {
          let closed = false;
          const thisChild = child;
          const onChildClosed = () => {
            // Don't invoke `onClose` more than once for a single child.
            if (!closed && child === thisChild) {
              closed = true;
              onClose();
            }
          };
          const onChildDisconnectedOrExited = () => {
            if (!closed && thisChild === child) {
              // Invoke `onClose` after enough time has elapsed to allow `close` to be triggered.
              // This is to ensure our `onClose` logic gets called in some conditions
              const timeout = 1000;
              setTimeout(onChildClosed, timeout);
            }
          };
          child.on("message", onMessage);
          child.on("close", onChildClosed);
          child.on("disconnect", onChildDisconnectedOrExited);
          child.on("exit", onChildDisconnectedOrExited);
          child.on("error", onError);
          taskAction();
        } catch (e) {
          onError(e as Error);
        }
      };

      const stopChild = (done: boolean) => {
        try {
          assert(runningChildren.has(child), `${processIndex}> Child not running`);
          if (done) {
            processesLeft--;
            if (processesLeft === 0) {
              resolve();
            }
          }
          runningChildren.delete(child);
          child.removeAllListeners();
          child.kill();
        } catch (e) {
          onError(e as Error);
        }
      };

      const restartChild = async (taskAction: () => void, execArgv: string[]) => {
        try {
          assert(runningChildren.has(child), `${processIndex}> Child not running`);
          console.log(`${processIndex}> Restarting...`);
          stopChild(/*done*/ false);
          await startChild(taskAction, execArgv);
        } catch (e) {
          onError(e as Error);
        }
      };

      const resumeTask = () => {
        try {
          assert(runningChildren.has(child), `${processIndex}> Child not running`);
          child.send(currentInput);
        } catch (e) {
          onError(e as Error);
        }
      };

      const nextTask = () => {
        try {
          assert(runningChildren.has(child), `${processIndex}> Child not running`);
          currentInput = inputs[inputIndex];
          inputIndex++;
          if (handleStart) {
            handleStart(currentInput, processIndex);
          }
          child.send(currentInput);
        } catch (e) {
          onError(e as Error);
        }
      };

      await startChild(nextTask, process.execArgv);
    }

    function fail(err?: Error): void {
      if (!rejected) {
        rejected = true;
        for (const child of runningChildren) {
          try {
            child.removeAllListeners();
            child.kill();
          } catch {
            // do nothing
          }
        }
        const message = err ? `: ${err.message}` : "";
        reject(new Error(`Something went wrong in ${runWithListeningChildProcesses.name}${message}`));
      }
    }
  });
}

const maxOldSpaceSizeRegExp = /^--max[-_]old[-_]space[-_]size(?:$|=(\d+))/;

interface MaxOldSpaceSizeArgument {
  index: number;
  size: number;
  value: number | undefined;
}

function getMaxOldSpaceSizeArg(argv: readonly string[]): MaxOldSpaceSizeArgument | undefined {
  for (let index = 0; index < argv.length; index++) {
    const match = maxOldSpaceSizeRegExp.exec(argv[index]);
    if (match) {
      const value = match[1] ? parseInt(match[1], 10) : argv[index + 1] ? parseInt(argv[index + 1], 10) : undefined;
      const size = match[1] ? 1 : 2; // tslint:disable-line:no-magic-numbers
      return { index, size, value };
    }
  }
  return undefined;
}

function getMaxOldSpaceSize(argv: readonly string[]): number | undefined {
  const arg = getMaxOldSpaceSizeArg(argv);
  return arg && arg.value;
}

let execArgvWithoutMaxOldSpaceSize: readonly string[] | undefined;

function getExecArgvWithoutMaxOldSpaceSize(): readonly string[] {
  if (!execArgvWithoutMaxOldSpaceSize) {
    // remove --max_old_space_size from execArgv
    const execArgv = process.execArgv.slice();
    let maxOldSpaceSizeArg = getMaxOldSpaceSizeArg(execArgv);
    while (maxOldSpaceSizeArg) {
      execArgv.splice(maxOldSpaceSizeArg.index, maxOldSpaceSizeArg.size);
      maxOldSpaceSizeArg = getMaxOldSpaceSizeArg(execArgv);
    }
    execArgvWithoutMaxOldSpaceSize = execArgv;
  }
  return execArgvWithoutMaxOldSpaceSize;
}

async function getChildProcessExecArgv(portOffset = 0, execArgv = process.execArgv) {
  const debugArg = execArgv.findIndex(
    (arg) => arg === "--inspect" || arg === "--inspect-brk" || arg.startsWith("--inspect=")
  );
  if (debugArg < 0) return execArgv;

  const port = parseInt(execArgv[debugArg].split("=")[1], 10) || 9229;
  return [
    ...execArgv.slice(0, debugArg),
    `--inspect=${await findFreePort(port + 1 + portOffset, 100, 1000)}`,
    ...execArgv.slice(debugArg + 1),
  ];
}

// From VS Code: https://github.com/microsoft/vscode/blob/7d57a8f6f546b5e30027e7cfa87bd834eb5c7bbb/src/vs/base/node/ports.ts

function findFreePort(startPort: number, giveUpAfter: number, timeout: number): Promise<number> {
  let done = false;

  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(() => {
      if (!done) {
        done = true;
        return resolve(0);
      }
    }, timeout);

    doFindFreePort(startPort, giveUpAfter, (port) => {
      if (!done) {
        done = true;
        clearTimeout(timeoutHandle);
        return resolve(port);
      }
    });
  });
}

function doFindFreePort(startPort: number, giveUpAfter: number, clb: (port: number) => void): void {
  if (giveUpAfter === 0) {
    return clb(0);
  }

  const client = new Socket();

  // If we can connect to the port it means the port is already taken so we continue searching
  client.once("connect", () => {
    dispose(client);

    return doFindFreePort(startPort + 1, giveUpAfter - 1, clb);
  });

  client.once("data", () => {
    // this listener is required since node.js 8.x
  });

  client.once("error", (err: Error & { code?: string }) => {
    dispose(client);

    // If we receive any non ECONNREFUSED error, it means the port is used but we cannot connect
    if (err.code !== "ECONNREFUSED") {
      return doFindFreePort(startPort + 1, giveUpAfter - 1, clb);
    }

    // Otherwise it means the port is free to use!
    return clb(startPort);
  });

  client.connect(startPort, "127.0.0.1");

  function dispose(socket: Socket): void {
    try {
      socket.removeAllListeners("connect");
      socket.removeAllListeners("error");
      socket.end();
      socket.destroy();
      socket.unref();
    } catch (error) {
      console.error(error); // otherwise this error would get lost in the callback chain
    }
  }
}

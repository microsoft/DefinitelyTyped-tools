import assert from "assert";
import { ChildProcess, exec as node_exec, fork } from "child_process";

const DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE = 4096;

/** Run a command and return the error, stdout, and stderr. (Never throws.) */
export function exec(cmd: string, cwd?: string): Promise<{ error: Error | undefined, stdout: string, stderr: string }> {
  return new Promise<{ error: Error | undefined, stdout: string, stderr: string }>(resolve => {
      // Fix "stdout maxBuffer exceeded" error
      // See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/26545#issuecomment-402274021
      const maxBuffer = 1024 * 1024 * 1; // Max = 1 MiB, default is 200 KiB

      node_exec(cmd, { encoding: "utf8", cwd, maxBuffer }, (error, stdout, stderr) => {
          resolve({ error: error === null ? undefined : error, stdout: stdout.trim(), stderr: stderr.trim() });
      });
  });
}

/** Run a command and return the stdout, or if there was an error, throw. */
export async function execAndThrowErrors(cmd: string, cwd?: string): Promise<string> {
  const { error, stdout, stderr } = await exec(cmd, cwd);
  if (error) {
      throw new Error(`${error.stack}\n${stderr}`);
  }
  return stdout + stderr;
}


export interface RunWithChildProcessesOptions<In> {
  readonly inputs: ReadonlyArray<In>;
  readonly commandLineArgs: string[];
  readonly workerFile: string;
  readonly nProcesses: number;
  handleOutput(output: unknown): void;
}
export function runWithChildProcesses<In>(
  { inputs, commandLineArgs, workerFile, nProcesses, handleOutput }: RunWithChildProcessesOptions<In>,
): Promise<void> {
  return new Promise((resolve, reject) => {
      const nPerProcess = Math.floor(inputs.length / nProcesses);
      let processesLeft = nProcesses;
      let rejected = false;
      const allChildren: ChildProcess[] = [];
      for (let i = 0; i < nProcesses; i++) {
          const lo = nPerProcess * i;
          const hi = i === nProcesses - 1 ? inputs.length : lo + nPerProcess;
          let outputsLeft = hi - lo; // Expect one output per input
          if (outputsLeft === 0) {
              // No work for this process to do, so don't launch it
              processesLeft--;
              continue;
          }
          const child = fork(workerFile, commandLineArgs);
          allChildren.push(child);
          child.send(inputs.slice(lo, hi));
          child.on("message", outputMessage => {
              handleOutput(outputMessage as unknown);
              assert(outputsLeft > 0);
              outputsLeft--;
              if (outputsLeft === 0) {
                  assert(processesLeft > 0);
                  processesLeft--;
                  if (processesLeft === 0) {
                      resolve();
                  }
                  child.kill();
              }
          });
          child.on("disconnect", () => {
              if (outputsLeft !== 0) {
                  fail();
              }
          });
          child.on("close", () => { assert(rejected || outputsLeft === 0); });
          child.on("error", fail);
      }

      function fail(): void {
          rejected = true;
          for (const child of allChildren) {
              child.kill();
          }
          reject(new Error("Parsing failed."));
      }
  });
}

export const enum CrashRecoveryState {
  Normal,
  Retry,
  RetryWithMoreMemory,
  Crashed,
}

interface RunWithListeningChildProcessesOptions<In> {
  readonly inputs: ReadonlyArray<In>;
  readonly commandLineArgs: string[];
  readonly workerFile: string;
  readonly nProcesses: number;
  readonly cwd: string;
  readonly crashRecovery?: boolean;
  readonly crashRecoveryMaxOldSpaceSize?: number;
  readonly softTimeoutMs?: number;
  handleOutput(output: unknown, processIndex: number | undefined): void;
  handleStart?(input: In, processIndex: number | undefined): void;
  handleCrash?(input: In, state: CrashRecoveryState, processIndex: number | undefined): void;
}
export function runWithListeningChildProcesses<In>(
  { inputs, commandLineArgs, workerFile, nProcesses, cwd, handleOutput, crashRecovery,
    crashRecoveryMaxOldSpaceSize = DEFAULT_CRASH_RECOVERY_MAX_OLD_SPACE_SIZE,
    handleStart, handleCrash, softTimeoutMs = Infinity }: RunWithListeningChildProcessesOptions<In>,
): Promise<void> {
  return new Promise((resolve, reject) => {
      let inputIndex = 0;
      let processesLeft = nProcesses;
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
                      } else {
                          nextTask();
                      }
                  }
              } catch (e) {
                  onError(e);
              }
          };

          const onClose = () => {
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
                              crashRecoveryState = maxOldSpaceSize < crashRecoveryMaxOldSpaceSize
                                  ? CrashRecoveryState.RetryWithMoreMemory
                                  : crashRecoveryState = CrashRecoveryState.Crashed;
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
                          restartChild(resumeTask, process.execArgv);
                          break;
                      case CrashRecoveryState.RetryWithMoreMemory:
                          restartChild(resumeTask, [
                              ...getExecArgvWithoutMaxOldSpaceSize(),
                              `--max_old_space_size=${crashRecoveryMaxOldSpaceSize}`,
                          ]);
                          break;
                      case CrashRecoveryState.Crashed:
                          crashRecoveryState = CrashRecoveryState.Normal;
                          if (inputIndex === inputs.length || Date.now() - startTime > softTimeoutMs) {
                              stopChild(/*done*/ true);
                          } else {
                              restartChild(nextTask, process.execArgv);
                          }
                          break;
                      default:
                          assert.fail(`${processIndex}> Unexpected crashRecoveryState: ${crashRecoveryState}`);
                  }
              } catch (e) {
                  onError(e);
              }
          };

          const onError = (err?: Error) => {
              child.removeAllListeners();
              runningChildren.delete(child);
              fail(err);
          };

          const startChild = (taskAction: () => void, execArgv: string[]) => {
              try {
                  child = fork(workerFile, commandLineArgs, { cwd, execArgv });
                  runningChildren.add(child);
              } catch (e) {
                  fail(e);
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
                  onError(e);
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
                  onError(e);
              }
          };

          const restartChild = (taskAction: () => void, execArgv: string[]) => {
              try {
                  assert(runningChildren.has(child), `${processIndex}> Child not running`);
                  console.log(`${processIndex}> Restarting...`);
                  stopChild(/*done*/ false);
                  startChild(taskAction, execArgv);
              } catch (e) {
                  onError(e);
              }
          };

          const resumeTask = () => {
              try {
                  assert(runningChildren.has(child), `${processIndex}> Child not running`);
                  child.send(currentInput);
              } catch (e) {
                  onError(e);
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
                  onError(e);
              }
          };

          startChild(nextTask, process.execArgv);
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

function getMaxOldSpaceSizeArg(argv: ReadonlyArray<string>): MaxOldSpaceSizeArgument | undefined {
  for (let index = 0; index < argv.length; index++) {
      const match = maxOldSpaceSizeRegExp.exec(argv[index]);
      if (match) {
          const value = match[1] ? parseInt(match[1], 10) :
              argv[index + 1] ? parseInt(argv[index + 1], 10) :
              undefined;
          const size = match[1] ? 1 : 2; // tslint:disable-line:no-magic-numbers
          return { index, size, value };
      }
  }
  return undefined;
}

function getMaxOldSpaceSize(argv: ReadonlyArray<string>): number | undefined {
  const arg = getMaxOldSpaceSizeArg(argv);
  return arg && arg.value;
}

let execArgvWithoutMaxOldSpaceSize: ReadonlyArray<string> | undefined;

function getExecArgvWithoutMaxOldSpaceSize(): ReadonlyArray<string> {
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

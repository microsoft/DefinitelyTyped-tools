import { EventEmitter } from "events";
import { pathExists, remove } from "fs-extra";
import { lockFilePath } from "../src/lib/settings";
import { withFileLock } from "../src/main";

describe("withFileLock", () => {

  // The file lock should be cleaned up as part of a successful test run,
  // but we clean up before and after just to make sure we don't create
  // any weird state with a failed or canceled test.
  beforeAll(() => {
    try { return remove(lockFilePath); } catch { return; }
  });
  afterAll(() => {
    try { return remove(lockFilePath); } catch { return; }
  });

  function getDeferred() {
    const eventEmitter = new EventEmitter();
    const resolve = () => eventEmitter.emit("resolve");
    const promise = new Promise<void>(resolve => {
      eventEmitter.once("resolve", resolve);
    });
    return { resolve, promise };
  }

  it("works", async () => {
    const { resolve, promise } = getDeferred();

    // Awaiting `withFileLock` does not await its callback!
    // `promise` will be pending until we call `resolve()`,
    // but `withFileLock` writes a file and resolves as soon
    // as it can.
    const result1 = await withFileLock(lockFilePath, () => promise);
    expect(result1).toMatchObject({ triggered: true });

    // At this point the file still exists and `promise` is still
    // pending. Calling again should tell us that the callback
    // was not triggered due to an ongoing run.
    const result2 = await withFileLock(lockFilePath, () => Promise.resolve());
    expect(result2).toMatchObject({ triggered: false });
    expect(result2).toHaveProperty("timestamp");

    // Resolving our promise should clean up.
    resolve();
    await promise;
    expect(!await pathExists(lockFilePath));
  });
});

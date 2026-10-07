import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock, Mock } from "node:test";
import { ProgressBar } from "../src/progress";

describe("ProgressBar", () => {
  let write: Mock<typeof process.stdout.write>;

  beforeEach(() => {
    mock.timers.enable({ apis: ["Date"], now: 1000 });
    write = mock.method(process.stdout, "write", () => true);
  });

  afterEach(() => {
    mock.reset();
    mock.timers.reset();
  });

  it("renders progress and replaces the previous line", () => {
    const progress = new ProgressBar({ name: "Testing", width: 4 });
    progress.update(0.5, "first");
    assert.equal(
      write.mock.calls.map((call) => call.arguments[0]).join(""),
      "\x1b[1G\x1b[2KTesting [██  ] first\x1b[1G",
    );

    write.mock.resetCalls();
    mock.timers.tick(251);
    progress.update(0.25, "next");
    assert.equal(
      write.mock.calls.map((call) => call.arguments[0]).join(""),
      "\x1b[1G\x1b[2KTesting [█   ] next\x1b[1G",
    );
  });

  it("throttles updates while retaining the latest flavor text", () => {
    const progress = new ProgressBar({ name: "Testing", width: 4 });
    progress.update(0);
    write.mock.resetCalls();
    progress.update(0.5, "retained");
    assert.equal(write.mock.callCount(), 0);

    mock.timers.tick(251);
    progress.update(0.5);
    assert.ok(
      write.mock.calls
        .map((call) => call.arguments[0])
        .join("")
        .includes("Testing [██  ] retained"),
    );
  });

  it("clamps progress and finishes with a newline without closing stdout", () => {
    const end = mock.method(process.stdout, "end", () => process.stdout);
    try {
      const progress = new ProgressBar({ name: "Testing", width: 4 });
      progress.update(-1);
      assert.ok(
        write.mock.calls
          .map((call) => call.arguments[0])
          .join("")
          .includes("Testing [    ]"),
      );

      write.mock.resetCalls();
      mock.timers.tick(251);
      progress.update(2);
      assert.ok(
        write.mock.calls
          .map((call) => call.arguments[0])
          .join("")
          .includes("Testing [████]"),
      );

      write.mock.resetCalls();
      progress.done();
      assert.equal(
        write.mock.calls.map((call) => call.arguments[0]).join(""),
        "\x1b[1G\x1b[2KTesting [████] Done!\x1b[1G\n",
      );
      assert.equal(end.mock.callCount(), 0);
    } finally {
      end.mock.restore();
    }
  });
});

import { ProgressBar } from "../src/progress";

describe("ProgressBar", () => {
  let write: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    write.mockRestore();
    jest.useRealTimers();
  });

  it("renders progress and replaces the previous line", () => {
    const progress = new ProgressBar({ name: "Testing", width: 4 });
    progress.update(0.5, "first");
    expect(write.mock.calls.map(([text]) => text).join("")).toBe("\x1b[1G\x1b[2KTesting [██  ] first\x1b[1G");

    write.mockClear();
    jest.advanceTimersByTime(251);
    progress.update(0.25, "next");
    expect(write.mock.calls.map(([text]) => text).join("")).toBe("\x1b[1G\x1b[2KTesting [█   ] next\x1b[1G");
  });

  it("throttles updates while retaining the latest flavor text", () => {
    const progress = new ProgressBar({ name: "Testing", width: 4 });
    progress.update(0);
    write.mockClear();
    progress.update(0.5, "retained");
    expect(write).not.toHaveBeenCalled();

    jest.advanceTimersByTime(251);
    progress.update(0.5);
    expect(write.mock.calls.map(([text]) => text).join("")).toContain("Testing [██  ] retained");
  });

  it("clamps progress and finishes with a newline without closing stdout", () => {
    const end = jest.spyOn(process.stdout, "end").mockImplementation(() => process.stdout);
    try {
      const progress = new ProgressBar({ name: "Testing", width: 4 });
      progress.update(-1);
      expect(write.mock.calls.map(([text]) => text).join("")).toContain("Testing [    ]");

      write.mockClear();
      jest.advanceTimersByTime(251);
      progress.update(2);
      expect(write.mock.calls.map(([text]) => text).join("")).toContain("Testing [████]");

      write.mockClear();
      progress.done();
      expect(write.mock.calls.map(([text]) => text).join("")).toBe("\x1b[1G\x1b[2KTesting [████] Done!\x1b[1G\n");
      expect(end).not.toHaveBeenCalled();
    } finally {
      end.mockRestore();
    }
  });
});

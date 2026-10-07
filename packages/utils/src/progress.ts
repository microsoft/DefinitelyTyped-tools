import { clearLine, cursorTo } from "readline";

export interface Options {
  /** Text to display in front of the progress bar. */
  name: string;
  /** Length of the progress bar. */
  width?: number;
  /** Only render an update if this many milliseconds have passed. */
  updateMinTime?: number;
}

export class ProgressBar {
  private readonly name: string;
  private readonly width: number;
  private readonly updateMinTime: number;

  /** Most recent flavor text. */
  private flavor = "";
  private lastUpdateMillis = 0;

  constructor(options: Options) {
    this.name = options.name;
    this.width = options.width === undefined ? 20 : options.width;
    this.updateMinTime = options.updateMinTime === undefined ? 250 : options.updateMinTime;
  }

  update(current: number, flavor?: string): void {
    if (flavor !== undefined) {
      this.flavor = flavor;
    }
    const now = +new Date();
    const diff = now - this.lastUpdateMillis;
    if (diff > this.updateMinTime) {
      this.lastUpdateMillis = now;
      this.doUpdate(current);
    }
  }

  private doUpdate(current: number): void {
    const nCellsFilled = Math.ceil(this.width * Math.min(1, Math.max(0, current)));
    cursorTo(process.stdout, 0);
    clearLine(process.stdout, 0);
    process.stdout.write(
      `${this.name} [${"█".repeat(nCellsFilled)}${" ".repeat(this.width - nCellsFilled)}]${this.flavor ? ` ${this.flavor}` : ""}`,
    );
    cursorTo(process.stdout, 0);
  }

  done(): void {
    this.flavor = "Done!";
    this.doUpdate(1);
    process.stdout.write("\n");
  }
}

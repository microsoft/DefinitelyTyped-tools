import charm = require("charm");

export interface Options {
	/** Text to display in front of the progress bar. */
	name: string;
	/** Length of the progress bar. */
	width?: number;
	/** Only render an update if this many milliseconds have passed. */
	updateMinTime?: number;
}

export default class ProgressBar {
	private readonly console = new UpdatableConsole();

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
		const now = +(new Date());
		const diff = now - this.lastUpdateMillis;
		if (diff > this.updateMinTime) {
			this.lastUpdateMillis = now;
			this.doUpdate(current);
		}
	}

	private doUpdate(current: number): void {
		current = Math.min(1, Math.max(0, current));
		const nCellsFilled = Math.ceil(this.width * current);
		this.console.update(charm => {
			charm.write(this.name);
			charm.write(" [");
			charm.write("█".repeat(nCellsFilled));
			if (nCellsFilled < this.width) {
				charm.right(this.width - nCellsFilled);
			}
			charm.write("]");
			if (this.flavor.length) {
				charm.write(" " + this.flavor);
			}
		});
	}

	done(): void {
		this.flavor = "Done!";
		this.doUpdate(1);
		this.console.end();
	}
}

/** A mutable line of text on the console. */
class UpdatableConsole {
	private readonly charm = charm(process.stdout);

	update(action: (charm: charm.CharmInstance) => void) {
		this.charm.push();
		this.charm.erase("line");
		action(this.charm);
		this.charm.pop();
	}

	end() {
		this.charm.write("\n");
		this.charm.end();
	}
}

const firstLetter = "a".charCodeAt(0);
const lastLetter = "z".charCodeAt(0);
const charWidth = lastLetter - firstLetter;
const strProgressTotal = charWidth * charWidth; // 2 characters

/** Tracks a string's progress through the alphabet. */
export function strProgress(str: string): number {
	const x = charProgress(str.charCodeAt(0)) * charWidth + charProgress(str.charCodeAt(1));
	return x / strProgressTotal;

	function charProgress(ch: number): number {
		if (Number.isNaN(ch) || ch <= firstLetter) {
			return 0;
		}
		if (ch >= lastLetter) {
			return charWidth;
		}
		return ch - firstLetter;
	}
}

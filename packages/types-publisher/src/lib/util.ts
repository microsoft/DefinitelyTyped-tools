export function parseJson(text: string): any {
	try {
		return JSON.parse(text);
	}
	catch (err) {
		throw new Error(`${err.message} due to JSON: ${text}`);
	}
}

export async function nAtATime<T, U>(n: number, input: T[], use: (t: T) => Promise<U>): Promise<U[]> {
	let res: U[] = [];
	for (let i = 0; i < input.length; i += n) {
		const thisInputs = input.slice(i, i + n);
		const thisBatch = await Promise.all(thisInputs.map(use));
		res.push(...thisBatch);
	}
	return res;
}

export async function filterAsyncOrdered<T>(arr: T[], shouldKeep: (t: T) => Promise<boolean>): Promise<T[]> {
	const shouldKeeps: boolean[] = await Promise.all(arr.map(shouldKeep));
	return arr.filter((_, idx) => shouldKeeps[idx]);
}

export async function mapAsyncOrdered<T, U>(arr: T[], mapper: (t: T) => Promise<U>): Promise<U[]> {
	const out = new Array(arr.length);
	await Promise.all(arr.map(async (em, idx) => {
		out[idx] = await mapper(em);
	}));
	return out;
}

// Based on http://www.nodegit.org/api/

export function Clone(url: string, localPath: string): Promise<Repository>;

export namespace Ignore {
	export function pathIsIgnored(repo: Repository, path: string): Promise<boolean>;
}

export namespace Repository {
	export function open(path: string): Promise<Repository>;
}

export interface Repository {
	checkoutBranch(branch: string): Promise<void>;
	getCurrentBranch(): Promise<Reference>;
	fetchAll(): Promise<void>;
	mergeBranches(to: string, from: string): Promise<void>;
	getStatus(): Promise<StatusFile[]>;
}

export interface Reference {
	name(): string;
}

export interface StatusFile {
	path(): string;
}
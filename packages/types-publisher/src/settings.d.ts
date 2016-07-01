interface PublishSettings {
	// e.g. 'typings', not '@typings'
	scopeName: string;
	// e.g. './output/''
	outputPath: string;

	// e.g. '../DefinitelyTyped'
	definitelyTypedPath: string;

	// The branch that DefinitelyTyped is sourced from
	sourceBranch: string;

	// e.g. 'alpha'
	prereleaseTag?: string;

	// e.g. 'latest'
	tag?: string;

	// Issue in types-publisher that we will use to track links to logs
	logsIssue: string;
}

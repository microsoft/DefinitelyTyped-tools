interface PublishSettings {
	// URL of the NPM registry to upload to.
	npmRegistry: string;
	// Username to use to publish to NPM.
	// Password is in the environment variable NPM_PASSWORD.
	npmUsername: string;

	// e.g. 'typings', not '@typings'
	scopeName: string;
	// e.g. './output/'
	outputPath: string;

	// e.g. './validateOutput/'
	validateOutputPath: string;

	// e.g. '../DefinitelyTyped'
	definitelyTypedPath: string;

	// Git location of the source repository.
	sourceRepository: "https://github.com/DefinitelyTyped/DefinitelyTyped.git";

	// The branch that DefinitelyTyped is sourced from
	sourceBranch: string;

	// e.g. 'alpha'
	prereleaseTag?: string;

	// e.g. 'latest'
	tag?: string;

	// Name of the azure storage account. Used for uploading data and logs.
	azureStorageAccount: string;

	// Name of the azure container.
	azureContainer: string;

	versionsBlobName: string;

	// Issue in types-publisher that we will use to report webhook errors.
	errorsIssue: string;
}

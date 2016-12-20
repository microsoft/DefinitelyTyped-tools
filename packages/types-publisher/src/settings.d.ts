interface PublishSettings {
	// URL of the NPM registry to upload to.
	npmRegistry: string;

	// e.g. 'typings', not '@typings'
	scopeName: string;
	// e.g. './output/'
	outputPath: string;

	// e.g. './validateOutput/'
	validateOutputPath: string;

	// Git location of the source repository.
	sourceRepository: "https://github.com/DefinitelyTyped/DefinitelyTyped.git";

	// The branch that DefinitelyTyped is sourced from
	sourceBranch: string;

	// Name of the azure storage account. Used for uploading data and logs.
	azureStorageAccount: string;

	// Name of the azure container.
	azureContainer: string;

	// URL of azure keyvault.
	azureKeyvault: string;

	// Issue in types-publisher that we will use to report webhook errors.
	errorsIssue: string;
}

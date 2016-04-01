interface SearchRecord {
	// types package name
	typePackageName: string;
	// npm package name
	npmPackageName: string;
	// globals
	globals: string[];
	// modules
	declaredExternalModules: string[];
	// project name
	packageName: string;
	// library name
	libraryName: string;
	// downloads in the last month from NPM
	downloads?: number;
}

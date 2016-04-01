

function detectProjectAndLibraryNameDuplicates() {
	check(info => info.libraryName, 'Library Name');
	check(info => info.projectName, 'Project Name');

	function check(func: (info: TypingsData) => string, key: string) {
		const lookup: { [libName: string]: string[] } = {};
		infos.forEach(info => {
			const name = func(info);
			if (name !== undefined) {
				(lookup[name] || (lookup[name] = [])).push(info.typingsPackageName);
			}
		});
		for (const k of Object.keys(lookup)) {
			if (lookup[k].length > 1) {
				warningLog.push(` * Duplicate ${key} descriptions "${k}"`);
				lookup[k].forEach(n => warningLog.push(`   * ${n}`));
			}
		}
	}
}

import { getGithubLinks, SourceLocation } from "@typescript/github-link";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { isAbsolute, relative, resolve, sep } from "path";

export interface Failure {
  path: string;
  error: string;
  packageUrl?: string;
  projects?: { path: string; url: string }[];
  errorLinks?: { start: number; end: number; url: string }[];
}

export async function addGithubLinks(failures: Failure[], definitelyTypedPath: string): Promise<void> {
  const typesPath = realpathSync(resolve(definitelyTypedPath, "types"));
  const locations: SourceLocation[] = [];
  const setters: ((url: string) => void)[] = [];

  function addLocation(file: string, lineNumber: number | undefined, setUrl: (url: string) => void) {
    if (!existsSync(file)) {
      return;
    }
    const path = realpathSync(file);
    const relativePath = relative(typesPath, path);
    // Resolve workspace symlinks, but don't link installed or external compiler files to DT.
    if (
      isAbsolute(relativePath) ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      relativePath.split(sep).includes("node_modules")
    ) {
      return;
    }
    locations.push({ path, lineNumber });
    setters.push(setUrl);
  }

  for (const failure of failures) {
    const packagePath = resolve(typesPath, failure.path);
    addLocation(resolve(packagePath, "package.json"), undefined, (url) => {
      failure.packageUrl = url.replace(/\/blob\//, "/tree/").replace(/\/package\.json$/, "");
    });
    const packageJsonPath = resolve(packagePath, "package.json");
    const projects: NonNullable<Failure["projects"]> = [];
    failure.projects = projects;
    if (existsSync(packageJsonPath)) {
      const packageJson: { tsconfigs?: unknown } = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const tsconfigs = packageJson.tsconfigs ?? ["tsconfig.json"];
      if (!Array.isArray(tsconfigs) || !tsconfigs.every((config): config is string => typeof config === "string")) {
        throw new Error(`Invalid tsconfigs in ${packageJsonPath}`);
      }
      for (const config of tsconfigs) {
        addLocation(resolve(packagePath, config), undefined, (url) => {
          projects.push({ path: config, url });
        });
      }
    }
    const links: NonNullable<Failure["errorLinks"]> = [];
    failure.errorLinks = links;
    let stylishFile: string | undefined;
    for (const match of failure.error.matchAll(/^.*$/gm)) {
      const line = match[0].replace(/\r$/, "");
      const prefixLength = line.startsWith("Error: ") ? "Error: ".length : 0;
      const position = /^(.+?\.(?:[cm]?tsx?|json))(?::(\d+):(\d+)|\((\d+),(\d+)\))/.exec(line.slice(prefixLength));
      const fileHeader = /^(.+\.(?:[cm]?tsx?|json))$/.exec(line);
      const stylishPosition = /^\s+(\d+):(\d+)\s+(?:error|warning)\b/.exec(line);
      if (position) {
        stylishFile = undefined;
        const file = resolve(packagePath, position[1]);
        addLocation(file, Number(position[2] ?? position[4]), (url) => {
          const start = match.index + prefixLength;
          links.push({ start, end: start + position[0].length, url });
        });
      } else if (fileHeader) {
        stylishFile = resolve(packagePath, fileHeader[1]);
        addLocation(stylishFile, undefined, (url) => {
          links.push({ start: match.index, end: match.index + line.length, url });
        });
      } else if (stylishPosition && stylishFile) {
        const start = match.index + line.indexOf(stylishPosition[1]);
        addLocation(stylishFile, Number(stylishPosition[1]), (url) => {
          links.push({ start, end: start + `${stylishPosition[1]}:${stylishPosition[2]}`.length, url });
        });
      } else if (line && !/^\s/.test(line)) {
        stylishFile = undefined;
      }
    }
  }

  const urls = await getGithubLinks(locations);
  urls.forEach((url, index) => {
    // github-link returns file: URLs for untracked files.
    if (url.startsWith("https://github.com/DefinitelyTyped/DefinitelyTyped/")) {
      setters[index](url);
    }
  });
}

if (require.main === module) {
  const [failuresPath, definitelyTypedPath] = process.argv.slice(2);
  if (!failuresPath || !definitelyTypedPath) {
    throw new Error("Usage: add-github-links <failures.json> <DefinitelyTyped checkout>");
  }
  const failures: Failure[] = JSON.parse(readFileSync(failuresPath, "utf8"));
  addGithubLinks(failures, definitelyTypedPath)
    .then(() => writeFileSync(failuresPath, JSON.stringify(failures), "utf8"))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

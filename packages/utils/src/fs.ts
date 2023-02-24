import assert from "assert";
import { join, relative } from "path";
import { assertDefined } from "./assertions";
import { pathExistsSync, readdirSync, statSync } from "fs-extra";
import { readFileSync, readJsonSync } from "./io";

/** Convert a path to use "/" instead of "\\" for consistency. (This affects content hash.) */
export function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

export function hasWindowsSlashes(path: string): boolean {
  return path.includes("\\");
}

/** Always use "/" for consistency. (This affects package content hash.) */
export function joinPaths(...paths: string[]): string {
  return paths.join("/");
}

/**
 * Readonly filesystem.
 * Paths provided to these methods should be relative to the FS object's root but not start with '/' or './'.
 */
export interface FS {
  /**
   * Alphabetically sorted list of files and subdirectories.
   * If dirPath is missing, reads the root.
   */
  readdir(dirPath?: string): readonly string[];
  readJson(path: string): unknown;
  readFile(path: string): string;
  isDirectory(dirPath: string): boolean;
  exists(path: string): boolean;
  /** FileSystem rooted at a child directory. */
  subDir(path: string): FS;
  /** Representation of current location, for debugging. */
  debugPath(): string;
}

export function createModuleResolutionHost(fs: FS): import("typescript").ModuleResolutionHost {
  return {
    fileExists: (filename) => fs.exists(filename),
    readFile: (filename) => fs.readFile(filename),
    directoryExists: (directoryName) => fs.exists(directoryName),
    getCurrentDirectory: () => "",
    realpath: (path) => path,
    useCaseSensitiveFileNames: () => true,
  };
}


interface ReadonlyDir extends ReadonlyMap<string, ReadonlyDir | string> {
  readonly parent: Dir | undefined;
}

// Map entries are Dir for directory and string for file.
export class Dir extends Map<string, Dir | string> implements ReadonlyDir {
  constructor(readonly parent: Dir | undefined) {
    super();
  }

  subdir(name: string): Dir {
    const x = this.get(name);
    if (x !== undefined) {
      if (typeof x === "string") {
        throw new Error(`File ${name} has same name as a directory?`);
      }
      return x;
    }
    const res = new Dir(this);
    this.set(name, res);
    return res;
  }

  finish(): Dir {
    const out = new Dir(this.parent);
    for (const key of Array.from(this.keys()).sort()) {
      const subDirOrFile = this.get(key)!;
      out.set(key, typeof subDirOrFile === "string" ? subDirOrFile : subDirOrFile.finish());
    }
    return out;
  }
}

export class InMemoryFS implements FS {
  /** pathToRoot is just for debugging */
  constructor(readonly curDir: ReadonlyDir, readonly pathToRoot: string) {}

  private tryGetEntry(path: string): ReadonlyDir | string | undefined {
    validatePath(path);
    if (path[0] === "/") {
      path = relative("/" + this.pathToRoot, path);
    }
    if (path === "") {
      return this.curDir;
    }
    const needsDir = path.endsWith("/");
    if (needsDir) {
      path = path.slice(0, -1);
    }

    const components = path.split("/");
    const baseName = assertDefined(components.pop());
    let dir = this.curDir;
    for (const component of components) {
      const entry = component === ".." ? dir.parent : dir.get(component);
      if (entry === undefined) {
        return undefined;
      }
      if (!(entry instanceof Dir)) {
        throw new Error(
          `No file system entry at ${this.pathToRoot}/${path}. Siblings are: ${Array.from(dir.keys()).toString()}`
        );
      }
      dir = entry;
    }
    const res = dir.get(baseName);
    return needsDir ? (res instanceof Dir ? res : undefined) : res;
  }

  private getEntry(path: string): ReadonlyDir | string {
    const entry = this.tryGetEntry(path);
    if (entry === undefined) {
      throw new Error(`No file system entry at ${this.pathToRoot}/${path}`);
    }
    return entry;
  }

  private getDir(dirPath: string): Dir {
    const res = this.getEntry(dirPath);
    if (!(res instanceof Dir)) {
      throw new Error(`${this.pathToRoot}/${dirPath} is a file, not a directory.`);
    }
    return res;
  }

  readFile(filePath: string): string {
    const res = this.getEntry(filePath);
    if (typeof res !== "string") {
      throw new Error(`${this.pathToRoot}/${filePath} is a directory, not a file.`);
    }
    return res;
  }

  readdir(dirPath?: string): readonly string[] {
    return Array.from((dirPath === undefined ? this.curDir : this.getDir(dirPath)).keys());
  }

  readJson(path: string): unknown {
    return JSON.parse(this.readFile(path)) as unknown;
  }

  isDirectory(path: string): boolean {
    return typeof this.getEntry(path) !== "string";
  }

  exists(path: string): boolean {
    return this.tryGetEntry(path) !== undefined;
  }

  subDir(path: string): FS {
    return new InMemoryFS(this.getDir(path), joinPaths(this.pathToRoot, path));
  }

  debugPath(): string {
    return this.pathToRoot;
  }
}

export class DiskFS implements FS {
  constructor(private readonly rootPrefix: string) {
    assert(rootPrefix.endsWith("/"));
  }

  private getPath(path: string | undefined): string {
    if (path === undefined) {
      return this.rootPrefix;
    }
    validatePath(path);
    if (path[0] === "/") {
      // For '/DefinitelyTyped/types/foo', assume `rootPrefix` is the relative path to DefinitelyTyped.
      const components = path.split("/");
      components.shift(); // Empty
      components.shift(); // Usually DefinitelyTyped or node_modules
      return join(this.rootPrefix, components.join("/"));
    }
    return this.rootPrefix + path;
  }

  readdir(dirPath?: string): readonly string[] {
    return readdirSync(this.getPath(dirPath))
      .sort()
      .filter((name) => name !== ".DS_Store");
  }

  isDirectory(dirPath: string): boolean {
    return statSync(this.getPath(dirPath)).isDirectory();
  }

  readJson(path: string): unknown {
    return readJsonSync(this.getPath(path));
  }

  readFile(path: string): string {
    return readFileSync(this.getPath(path));
  }

  exists(path: string): boolean {
    return pathExistsSync(this.getPath(path));
  }

  subDir(path: string): FS {
    return new DiskFS(`${this.rootPrefix}${path}/`);
  }

  debugPath(): string {
    return this.rootPrefix.slice(0, this.rootPrefix.length - 1); // remove trailing '/'
  }
}

/** FS only handles simple paths like `foo/bar` or `../foo`. No `./foo` or `/foo`. */
function validatePath(path: string): void {
  if (path.startsWith(".") && path !== ".editorconfig" && path !== ".eslintrc.json" && !path.startsWith("../")) {
    throw new Error(`${path}: filesystem doesn't support paths of the form './x'.`);
  }
}

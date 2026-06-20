/// <reference types="jest" />
import { createProgram } from "../src/createProgram";
import fs from "fs";
import path from "path";
import os from "os";

describe("createProgram", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtslint-createprogram-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a program from a valid tsconfig", () => {
    const indexFile = path.join(tmpDir, "index.d.ts");
    fs.writeFileSync(indexFile, "export declare const x: number;");
    const tsconfigPath = path.join(tmpDir, "tsconfig.json");
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true },
        files: ["index.d.ts"],
      }),
    );

    const program = createProgram(tsconfigPath);
    expect(program).toBeDefined();
    const sourceFiles = program.getSourceFiles();
    const userFiles = sourceFiles.filter((f) => !program.isSourceFileDefaultLibrary(f));
    expect(userFiles.length).toBeGreaterThanOrEqual(1);
    expect(userFiles.some((f) => f.fileName.includes("index.d.ts"))).toBe(true);
  });

  it("throws for a tsconfig with read errors", () => {
    expect(() => createProgram(path.join(tmpDir, "nonexistent.json"))).toThrow();
  });

  it("throws for a tsconfig with invalid JSON", () => {
    const tsconfigPath = path.join(tmpDir, "tsconfig.json");
    fs.writeFileSync(tsconfigPath, "{ invalid json }}}");
    expect(() => createProgram(tsconfigPath)).toThrow();
  });

  it("ignores TS18003 (no inputs found) warning", () => {
    const tsconfigPath = path.join(tmpDir, "tsconfig.json");
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true },
      }),
    );

    // Should not throw despite no input files
    const program = createProgram(tsconfigPath);
    expect(program).toBeDefined();
  });
});

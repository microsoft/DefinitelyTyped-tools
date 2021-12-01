import { dtsCritic as critic, ErrorKind } from "./index";
import fs = require("fs");
import stripJsonComments = require("strip-json-comments");

function hasNpmNamingLintRule(tslintPath: string): boolean {
  if (fs.existsSync(tslintPath)) {
    const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, "utf-8")));
    if (tslint.rules && tslint.rules["npm-naming"] !== undefined) {
      return !!tslint.rules["npm-naming"];
    }
    return true;
  }
  return false;
}

function addNpmNamingLintRule(tslintPath: string): void {
  if (fs.existsSync(tslintPath)) {
    const tslint = JSON.parse(stripJsonComments(fs.readFileSync(tslintPath, "utf-8")));
    if (tslint.rules) {
      tslint.rules["npm-naming"] = false;
    } else {
      tslint.rules = { "npm-naming": false };
    }
    fs.writeFileSync(tslintPath, JSON.stringify(tslint, undefined, 4), "utf-8");
  }
}

function main() {
  for (const item of fs.readdirSync("../DefinitelyTyped/types")) {
    const entry = "../DefinitelyTyped/types/" + item;
    try {
      if (hasNpmNamingLintRule(entry + "/tslint.json")) {
        const errors = critic(entry + "/index.d.ts");
        for (const error of errors) {
          switch (error.kind) {
            case ErrorKind.NoMatchingNpmPackage:
              console.log(`No matching npm package found for ` + item);
              // const re = /\/\/ Type definitions for/;
              // const s = fs.readFileSync(entry + '/index.d.ts', 'utf-8')
              // fs.writeFileSync(entry + '/index.d.ts', s.replace(re, '// Type definitions for non-npm package'), 'utf-8')
              break;
            case ErrorKind.NoDefaultExport:
              console.log("converting", item, "to export = ...");
              const named = /export default function\s+(\w+\s*)\(/;
              const anon = /export default function\s*\(/;
              const id = /export default(\s+\w+);/;
              let s = fs.readFileSync(entry + "/index.d.ts", "utf-8");
              s = s.replace(named, "export = $1;\ndeclare function $1(");
              s = s.replace(anon, "export = _default;\ndeclare function _default(");
              s = s.replace(id, "export =$1;");
              fs.writeFileSync(entry + "/index.d.ts", s, "utf-8");
              break;
            case ErrorKind.NoMatchingNpmVersion:
              const m = error.message.match(/in the header, ([0-9.]+),[\s\S]to match one on npm: ([0-9., ]+)\./);
              if (m) {
                const headerver = parseFloat(m[1]);
                const npmvers = m[2].split(",").map((s: string) => parseFloat(s.trim()));
                const fixto = npmvers.every((v: number) => headerver > v) ? -1.0 : Math.max(...npmvers);
                console.log(`npm-version:${item}:${m[1]}:${m[2]}:${fixto}`);
                addNpmNamingLintRule(entry + "/tslint.json");
              } else {
                console.log("could not parse error message: ", error.message);
              }
              break;
            default:
              console.log(error.message);
          }
        }
      }
    } catch (e) {
      console.log("*** ERROR for " + item + " ***");
      console.log(e);
    }
  }
}
main();

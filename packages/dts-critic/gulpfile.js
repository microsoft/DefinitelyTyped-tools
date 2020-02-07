const gulp = require("gulp");
const ts = require("gulp-typescript");
const jest = require("jest-cli");

const tsProject = ts.createProject("tsconfig.json");

function build() {
    return tsProject.src().pipe(tsProject()).js.pipe(gulp.dest(tsProject.options.outDir || "dist"));
}

async function test() {
    const args = {_: [], $0: "" };
    jest.runCLI(args, ["."]);
}

gulp.task("build", build);
gulp.task("default", build);
gulp.task("test", gulp.series(build, test));

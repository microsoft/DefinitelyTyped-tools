import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { addGithubLinks, Failure } from "../src/add-github-links";
import { getDiffComment, getDiffLog, getResultComments, main } from "../src/post-results";

const mockCreateComment = jest.fn();
const mockGetComment = jest.fn();
const mockUpdateComment = jest.fn();
jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    issues: { createComment: mockCreateComment },
    rest: { issues: { getComment: mockGetComment, updateComment: mockUpdateComment } },
  })),
}));

const repoUrl = "https://github.com/DefinitelyTyped/DefinitelyTyped";
let checkout: string;
let commit: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
}

function writeFile(path: string, contents = ""): string {
  const file = join(checkout, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return file;
}

beforeAll(() => {
  checkout = mkdtempSync(join(tmpdir(), "dt-result-links-"));
  git("init", "--quiet");
  writeFile("types/example/package.json", "{}");
  writeFile("types/example/tsconfig.json", "{}");
  writeFile("types/example/index.d.ts", "export {};\n");
  writeFile("types/example/example-tests.ts", "export {};\n");
  writeFile("types/example/v1/package.json", '{"tsconfigs":["tsconfig.json","tsconfig.other.json"]}');
  writeFile("types/example/v1/tsconfig.json", "{}");
  writeFile("types/example/v1/tsconfig.other.json", "{}");
  writeFile("types/example/v1/index.d.ts", "export {};\n");
  writeFile("types/dependency/package.json", "{}");
  writeFile("types/dependency/index.d.ts", "export {};\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    "Fixture",
  );
  commit = git("rev-parse", "HEAD");
  git("remote", "add", "origin", `${repoUrl}.git`);
  git("update-ref", "refs/remotes/origin/master", commit);
  git("checkout", "--quiet", "--detach", commit);
  writeFile("types/example/untracked.ts");
  writeFile("types/example/node_modules/external/index.d.ts");
  writeFile("compiler/lib.d.ts");
  symlinkSync(join(checkout, "types/dependency"), join(checkout, "types/example/node_modules/dependency"), "dir");
});

afterAll(() => {
  rmSync(checkout, { recursive: true, force: true });
});

test("adds pinned package and Corsa diagnostic links without changing the raw errors", async () => {
  const file = join(checkout, "types/example/example-tests.ts");
  const error = `${file}:12:3\nTypeScript@local compile error TS2322: Type '<T>' is not assignable.\n\nindex.d.ts:2:1\nExpected type.`;
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  expect(failures[0].error).toBe(error);
  expect(failures[0].packageUrl).toBe(`${repoUrl}/tree/${commit}/types/example`);
  expect(failures[0].errorLinks?.map(({ start, end, url }) => [error.slice(start, end), url])).toEqual([
    [`${file}:12:3`, `${repoUrl}/blob/${commit}/types/example/example-tests.ts#L12`],
    ["index.d.ts:2:1", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`],
  ]);
  const comment = getDiffComment([], failures)!;
  expect(comment).toContain(`<code><a href="${repoUrl}/tree/${commit}/types/example">example</a></code>`);
  expect(comment).toContain(
    `<pre><a href="${repoUrl}/blob/${commit}/types/example/example-tests.ts#L12">${file}:12:3</a>`,
  );
  expect(comment).toContain("Type '&lt;T&gt;' is not assignable.");
});

test("links ESLint stylish headers and individual error lines, including CRLF", async () => {
  const file = join(checkout, "types/example/index.d.ts");
  const error = `\r\n${file}\r\n  2:3  error  First error\r\n       With elaboration\r\n  4:5  warning  Second error\r\n\r\n2 problems`;
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  expect(failures[0].errorLinks?.map(({ start, end, url }) => [error.slice(start, end), url])).toEqual([
    [file, `${repoUrl}/blob/${commit}/types/example/index.d.ts`],
    ["2:3", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`],
    ["4:5", `${repoUrl}/blob/${commit}/types/example/index.d.ts#L4`],
  ]);
});

test("resolves versioned packages, workspace dependencies, and tsc locations", async () => {
  const failures: Failure[] = [
    { path: "example/v1", error: "index.d.ts(3,4): error TS2322: Example" },
    { path: "example", error: "node_modules/dependency/index.d.ts:5:6\nExample" },
  ];
  await addGithubLinks(failures, checkout);
  expect(failures[0].packageUrl).toBe(`${repoUrl}/tree/${commit}/types/example/v1`);
  expect(failures[0].errorLinks?.[0].url).toBe(`${repoUrl}/blob/${commit}/types/example/v1/index.d.ts#L3`);
  expect(failures[1].errorLinks?.[0].url).toBe(`${repoUrl}/blob/${commit}/types/dependency/index.d.ts#L5`);
});

test("leaves untracked, missing, installed, and external files unlinked", async () => {
  const failures: Failure[] = [
    {
      path: "example",
      error: [
        "untracked.ts:1:1",
        "missing.ts:1:1",
        "node_modules/external/index.d.ts:1:1",
        `${join(checkout, "compiler/lib.d.ts")}:1:1`,
        "Out of memory",
      ].join("\n"),
    },
  ];
  await addGithubLinks(failures, checkout);
  expect(failures[0].errorLinks).toEqual([]);
  expect(getDiffComment([], failures)).toContain(`<pre>${failures[0].error}</pre>`);
});

test("handles empty failure lists and fails explicitly when the checkout has no GitHub remote", async () => {
  await expect(addGithubLinks([], checkout)).resolves.toBeUndefined();
  git("remote", "remove", "origin");
  try {
    await expect(addGithubLinks([{ path: "example", error: "Out of memory" }], checkout)).rejects.toThrow(
      "not present on any remote",
    );
  } finally {
    git("remote", "add", "origin", `${repoUrl}.git`);
    git("update-ref", "refs/remotes/origin/master", commit);
  }
});

test("compares only raw errors, not link metadata", () => {
  expect(
    getDiffComment(
      [{ path: "example", error: "same" }],
      [{ path: "example", error: "same", packageUrl: `${repoUrl}/tree/different/types/example`, errorLinks: [] }],
    ),
  ).toBeUndefined();
  expect(getDiffComment([], [])).toBeUndefined();
});

test("renders all three difference categories, retaining each side's links", () => {
  const mainUrl = `${repoUrl}/blob/base/types/example/index.d.ts#L1`;
  const branchUrl = `${repoUrl}/blob/head/types/example/index.d.ts#L2`;
  const comment = getDiffComment(
    [
      { path: "fixed", error: "old failure" },
      { path: "changed", error: "old", errorLinks: [{ start: 0, end: 3, url: mainUrl }] },
    ],
    [
      { path: "new", error: "new failure" },
      { path: "changed", error: "new", errorLinks: [{ start: 0, end: 3, url: branchUrl }] },
    ],
  )!;
  expect(comment).toContain("<summary>Branch only errors: <code>new</code></summary>");
  expect(comment).toContain("<summary>Main only errors: <code>fixed</code></summary>");
  expect(comment).toContain("<summary>Errors that changed between main and the branch: <code>changed</code></summary>");
  expect(comment).toContain(`<pre><a href="${mainUrl}">old</a></pre>`);
  expect(comment).toContain(`<pre><a href="${branchUrl}">new</a></pre>`);
  expect(comment).toContain("<pre>old failure</pre>");
  expect(comment).toContain("<pre>new failure</pre>");
});

test("escapes diagnostic HTML and refuses non-DT links", () => {
  const error = '</pre><script>alert("oops")</script>\n```\n& <T>';
  const comment = getDiffComment(
    [],
    [
      {
        path: "<example>",
        error,
        packageUrl: "javascript:alert(1)",
        errorLinks: [{ start: 0, end: 6, url: "file:///private/file" }],
      },
    ],
  )!;
  expect(comment).toContain("<summary>Branch only errors: <code>&lt;example&gt;</code></summary>");
  expect(comment).toContain("Package: <code>&lt;example&gt;</code>");
  expect(comment).toContain("&lt;/pre&gt;&lt;script&gt;alert(&quot;oops&quot;)&lt;/script&gt;\n```\n&amp; &lt;T&gt;");
  expect(comment).not.toContain("<script>");
  expect(comment).not.toContain("<a ");
});

test("links project-level errors to the default and explicitly configured tsconfigs", async () => {
  const failures: Failure[] = [
    { path: "example", error: "TypeScript@local compile error TS18003: No inputs were found." },
    { path: "example/v1", error: "Project-level failure" },
  ];
  await addGithubLinks(failures, checkout);
  expect(failures[0].projects).toEqual([
    { path: "tsconfig.json", url: `${repoUrl}/blob/${commit}/types/example/tsconfig.json` },
  ]);
  expect(failures[1].projects).toEqual([
    { path: "tsconfig.json", url: `${repoUrl}/blob/${commit}/types/example/v1/tsconfig.json` },
    { path: "tsconfig.other.json", url: `${repoUrl}/blob/${commit}/types/example/v1/tsconfig.other.json` },
  ]);
  const comment = getDiffComment([], failures)!;
  expect(comment).toContain("<summary>Branch only errors: <code>example/v1</code></summary>");
  expect(comment).toContain(`Project scope: <code><a href="${failures[0].projects![0].url}">tsconfig.json</a></code>`);
  expect(comment).toContain(`href="${failures[1].projects![1].url}"`);
});

test("logs full raw diagnostics and explicit URLs instead of HTML or Markdown", async () => {
  const error = "index.d.ts:2:1\nType <T> & Other\n##vso[task.setvariable variable=foo]bar";
  const failures: Failure[] = [{ path: "example", error }];
  await addGithubLinks(failures, checkout);
  const log = getDiffLog([], failures);
  expect(log).toContain("Type <T> & Other");
  expect(log).toContain(`index.d.ts:2:1 -> ${repoUrl}/blob/${commit}/types/example/index.d.ts#L2`);
  expect(log).toContain(`Project: tsconfig.json\n  ${repoUrl}/blob/${commit}/types/example/tsconfig.json`);
  expect(log).not.toMatch(/<pre>|<a href|<details>|&lt;/);
  expect(log).not.toContain("##vso[");
  expect(log).toContain("# #vso[task.setvariable variable=foo]bar");
  expect(log.split("\n").every((line) => !line || line.startsWith("  "))).toBe(true);
  expect(getDiffLog(failures, failures)).toBe("");
});

const logUrl = "https://dev.azure.com/example/project/_build/results?buildId=123&view=logs";

function expectBalancedComments(comments: string[]) {
  for (const comment of comments) {
    expect(comment.length).toBeLessThanOrEqual(65535);
    for (const tag of ["details", "pre", "code", "a"]) {
      expect(comment.match(new RegExp(`<${tag}(?:>| )`, "g"))?.length ?? 0).toBe(
        comment.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0,
      );
    }
    expect(comment).toContain(`[Full output in the log](${logUrl}).`);
  }
}

test("paginates at package boundaries without losing any reports", () => {
  const failures = Array.from({ length: 8 }, (_, i) => ({ path: `package-${i}`, error: `${i}:` + "x".repeat(20000) }));
  const comments = getResultComments([], failures, "tester", logUrl);
  expect(comments.length).toBeGreaterThan(1);
  expectBalancedComments(comments);
  expect(comments[0]).toContain("the results of running");
  expect(comments[1]).toContain("here are more DT test results");
  const combined = comments.join("\n");
  for (const failure of failures) {
    expect(combined.split(`Package: <code>${failure.path}</code>`)).toHaveLength(2);
    expect(combined).toContain(failure.error);
  }
  expect(combined).not.toContain("truncated");
});

test("fits the exact comment limit and starts a new comment when adding another report", () => {
  const failure = { path: "exact", error: "" };
  const overhead = getResultComments([], [failure], "tester", logUrl)[0].length;
  failure.error = "x".repeat(65535 - overhead);
  const comments = getResultComments([], [failure, { path: "next", error: "next" }], "tester", logUrl);
  expect(comments).toHaveLength(2);
  expect(comments[0]).toHaveLength(65535);
  expect(comments[0]).not.toContain("truncated");
  expectBalancedComments(comments);
});

test("safely truncates oversized individual reports but retains full linked output in logs", () => {
  const url = `${repoUrl}/blob/${"a".repeat(40)}/types/example/index.d.ts#L1`;
  const failure: Failure = {
    path: "huge",
    error: 'index.d.ts:1:1\n<&"😀>'.repeat(20000),
    errorLinks: [{ start: 0, end: "index.d.ts:1:1".length, url }],
  };
  const comments = getResultComments([], [failure, { path: "next", error: "still included" }], "tester", logUrl);
  expect(comments).toHaveLength(2);
  expectBalancedComments(comments);
  expect(comments[0]).toContain(`<a href="${url}">index.d.ts:1:1</a>`);
  expect(comments[0]).toContain("&lt;&amp;&quot;😀&gt;");
  expect(comments[0]).toContain("[... truncated ...]");
  expect(comments[0]).toContain("This package report was truncated");
  expect(Buffer.from(comments[0]).toString("utf8")).toBe(comments[0]);
  expect(comments[1]).toContain("still included");
  const log = getDiffLog([], [failure]);
  expect(log).toContain(failure.error.split("\n").join("\n  "));
  expect(log).toContain(url);
  expect(log).not.toContain("truncated");
});

test("keeps both sides and balanced markup when a changed report exceeds the limit", () => {
  const comments = getResultComments(
    [{ path: "changed", error: "<old>".repeat(20000) }],
    [{ path: "changed", error: "<new>".repeat(20000) }],
    "tester",
    logUrl,
  );
  expect(comments).toHaveLength(1);
  expectBalancedComments(comments);
  expect(comments[0]).toContain("Main error:");
  expect(comments[0]).toContain("Branch error:");
  expect(comments[0]).toContain("&lt;old&gt;");
  expect(comments[0]).toContain("&lt;new&gt;");
});

test.each([
  { scenario: "branch-only errors across multiple chunks", kind: "new", emoji: "👀", count: 4 },
  { scenario: "main-only errors", kind: "fixed", emoji: "✅", count: 1 },
  { scenario: "changed errors", kind: "changed", emoji: "👀", count: 1 },
  { scenario: "unchanged errors", kind: "same", emoji: "✅", count: 1 },
  { scenario: "no errors", kind: "empty", emoji: "✅", count: 1 },
  { scenario: "infrastructure failure", kind: "fail", emoji: "❌", count: 1 },
])("posts results and updates the status for $scenario", async ({ kind, emoji, count }) => {
  const args = process.argv;
  const env = { ...process.env };
  const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.useFakeTimers();
  const failures = Array.from({ length: 4 }, (_, i) => ({ path: `package-${i}`, error: "x".repeat(40000) }));
  const oldError = { path: "example", error: "old error" };
  const mainFailures = ["fixed", "changed", "same"].includes(kind) ? [oldError] : [];
  const branchFailures =
    kind === "new"
      ? failures
      : kind === "changed"
        ? [{ path: "example", error: "new error" }]
        : kind === "same"
          ? [oldError]
          : [];
  writeFile("results/pr/failures.json", JSON.stringify(branchFailures));
  writeFile("results/main/failures.json", JSON.stringify(mainFailures));
  process.argv = [
    "node",
    "post-results",
    "fake-token",
    "123",
    "456",
    "tester",
    "789",
    "test-run",
    kind === "fail" ? "fail" : "ok",
    join(checkout, "results/main"),
    join(checkout, "results/pr"),
  ];
  process.env.SYSTEM_COLLECTIONURI = "https://dev.azure.com/example/";
  process.env.SYSTEM_TEAMPROJECT = "project";
  process.env.SYSTEM_JOBID = "job";
  process.env.SYSTEM_TASKINSTANCEID = "task";
  mockCreateComment.mockReset().mockImplementation(async () => ({
    data: {
      html_url: `https://github.com/microsoft/TypeScript/issues/789#issuecomment-${mockCreateComment.mock.calls.length}`,
    },
  }));
  mockGetComment
    .mockReset()
    .mockResolvedValueOnce({ data: { body: "Status: <!--result-test-run-->" } })
    .mockResolvedValue({ data: { body: "Status: updated" } });
  mockUpdateComment.mockReset().mockResolvedValue({});
  try {
    const result = main();
    await jest.runAllTimersAsync();
    await result;
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockCreateComment).toHaveBeenCalledTimes(count);
    const bodies = mockCreateComment.mock.calls.map(([arg]) => arg.body as string);
    expect(bodies.every((body) => body.length <= 65535)).toBe(true);
    const status = mockUpdateComment.mock.calls[0][0].body;
    expect(status).toContain(`[${emoji} Results]`);
    for (let i = 1; i <= count; i++) {
      expect(status).toContain(`https://github.com/microsoft/TypeScript/issues/789#issuecomment-${i}`);
    }
    if (kind === "new") {
      expect(bodies.join("\n")).toContain("&j=job&t=task");
      expect(status).toContain("Part 4");
      expect(consoleLog.mock.calls[0][0]).toContain("Branch only errors:");
      expect(consoleLog.mock.calls[0][0]).not.toContain("<pre>");
    }
    if (kind === "fixed") {
      expect(bodies[0]).toContain("Main only errors:");
      expect(bodies[0]).toContain(oldError.error);
    }
  } finally {
    process.argv = args;
    process.env = env;
    jest.useRealTimers();
    consoleLog.mockRestore();
    consoleError.mockRestore();
  }
});

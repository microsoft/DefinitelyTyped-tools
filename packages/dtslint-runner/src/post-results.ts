import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import glob = require("glob");
import type { Failure } from "./add-github-links";

type Errors = Failure[];

// Args: [auth token] [buildId] [status comment] [user to tag] [issue] [distinct id] [job status] [?main errors file] [?branch errors file]
export async function main() {
  const [auth, buildId, statusCommentId, userToTag, issue, distinctId, status, mainErrorsPath, branchErrorsPath] =
    process.argv.slice(2);
  if (!auth) throw new Error("First argument must be a GitHub auth token.");
  if (!buildId) throw new Error("Second argument must be a build id.");
  if (!statusCommentId) throw new Error("Third argument must be a GitHub comment id.");
  if (!userToTag) throw new Error("Fourth argument must be a GitHub username.");
  if (!issue) throw new Error("Fifth argument must be a TypeScript issue/PR number.");
  if (!distinctId) throw new Error("Sixth argument must be a distinct ID.");
  if (!status) throw new Error("Seventh argument must be a status ('ok' or 'fail').");

  const gh = new Octokit({ auth });
  let checkLogsMessage = "";

  try {
    const collectionUri = process.env.SYSTEM_COLLECTIONURI;
    const teamProject = process.env.SYSTEM_TEAMPROJECT;
    if (!collectionUri) throw new Error("SYSTEM_COLLECTIONURI must be set.");
    if (!teamProject) throw new Error("SYSTEM_TEAMPROJECT must be set.");
    const buildPath = `${encodeURIComponent(teamProject)}/_build/results?buildId=${encodeURIComponent(buildId)}`;
    const buildUrl = new URL(buildPath, collectionUri);
    checkLogsMessage = `\n\n[You can check the log here](${buildUrl}).`;

    let comments: string[];
    let emoji = "✅";
    if (status === "fail") {
      comments = [
        `Hey @${userToTag}, it looks like the DT test run failed. Please check the log for more details.` +
          checkLogsMessage,
      ];
      emoji = "❌";
    } else {
      const mainErrors: Errors = [];
      if (mainErrorsPath) {
        const mainFiles = glob.sync(`**/*.json`, { cwd: mainErrorsPath, absolute: true });
        for (const file of mainFiles) {
          mainErrors.push(...(JSON.parse(readFileSync(file, "utf-8")) as Errors));
        }
      }
      const branchErrors: Errors = [];
      if (branchErrorsPath) {
        const branchFiles = glob.sync(`**/*.json`, { cwd: branchErrorsPath, absolute: true });
        for (const file of branchFiles) {
          branchErrors.push(...(JSON.parse(readFileSync(file, "utf-8")) as Errors));
        }
      }

      const reports = getDiffReports(mainErrors, branchErrors);
      if (reports.length) {
        emoji = "👀";
        console.log(formatDiffLog(reports));
        const jobId = process.env.SYSTEM_JOBID;
        const taskId = process.env.SYSTEM_TASKINSTANCEID;
        const logUrl =
          jobId && taskId
            ? new URL(
                `${buildPath}&view=logs&j=${encodeURIComponent(jobId)}&t=${encodeURIComponent(taskId)}`,
                collectionUri,
              )
            : buildUrl;
        comments = getResultComments(mainErrors, branchErrors, userToTag, logUrl.toString());
      } else {
        comments = [
          `Hey @${userToTag}, the results of running the DT tests are ready.\n\nEverything looks the same!${checkLogsMessage}`,
        ];
      }
    }

    const resultUrls: string[] = [];
    for (const body of comments) {
      const result = await gh.issues.createComment({
        issue_number: +issue,
        owner: "Microsoft",
        repo: "TypeScript",
        body,
      });
      resultUrls.push(result.data.html_url);
    }

    const toReplace = `<!--result-${distinctId}-->`;
    let posted = false;
    for (let i = 0; i < 5; i++) {
      // Get status comment contents
      const statusComment = await gh.rest.issues.getComment({
        comment_id: +statusCommentId,
        owner: "Microsoft",
        repo: "TypeScript",
      });

      const oldComment = statusComment.data.body;
      if (!oldComment?.includes(toReplace)) {
        posted = true;
        break;
      }

      const newComment = oldComment.replace(
        toReplace,
        resultUrls.map((url, index) => `[${index ? `Part ${index + 1}` : `${emoji} Results`}](${url})`).join(" · "),
      );

      // Update status comment
      await gh.rest.issues.updateComment({
        comment_id: +statusCommentId,
        owner: "Microsoft",
        repo: "TypeScript",
        body: newComment,
      });

      // Repeat; someone may have edited the comment at the same time.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!posted) {
      throw new Error("Failed to update status comment");
    }
  } catch (e) {
    console.error(e);
    // TODO(jakebailey): is this a good idea? all that can really fail here is the GH API.
    await gh.issues.createComment({
      issue_number: +issue,
      owner: "Microsoft",
      repo: "TypeScript",
      body: `Hey @${userToTag}, something went wrong when publishing results from the DT run.` + checkLogsMessage,
    });
  }
}

export function getDiffComment(main: Errors, branch: Errors): string | undefined {
  const reports = getDiffReports(main, branch);
  return reports.length ? reports.map((report) => formatReport(report)).join("\n\n") : undefined;
}

interface DiffReport {
  title: string;
  main?: Failure;
  branch?: Failure;
}

function getDiffReports(main: Errors, branch: Errors): DiffReport[] {
  const mainMap = new Map(main.map((error) => [error.path, error]));
  const branchMap = new Map(branch.map((error) => [error.path, error]));

  const mainOnly = [];
  const bothChanged = [];
  const branchOnly = [];

  for (const [path, error] of mainMap) {
    if (branchMap.has(path)) {
      const branchError = branchMap.get(path)!;
      if (branchError.error !== error.error) {
        bothChanged.push({ main: error, branch: branchError });
      }
    } else {
      mainOnly.push(error);
    }
  }

  for (const [path, error] of branchMap) {
    if (mainMap.has(path)) {
      continue; // Already considered above
    } else {
      branchOnly.push(error);
    }
  }

  return [
    ...branchOnly.map((branch) => ({ title: "Branch only errors:", branch })),
    ...bothChanged.map((errors) => ({ title: "Errors that changed between main and the branch:", ...errors })),
    ...mainOnly.map((main) => ({ title: "Main only errors:", main })),
  ];
}

function formatReport(report: DiffReport, maxErrorLength = Infinity): string {
  const errors = [
    ...(report.main ? [`Main error:\n${formatProjects(report.main)}${formatError(report.main, maxErrorLength)}`] : []),
    ...(report.branch
      ? [`Branch error:\n${formatProjects(report.branch)}${formatError(report.branch, maxErrorLength)}`]
      : []),
  ];
  return `<details>\n<summary>${report.title}</summary>\n\n${formatPackage((report.branch ?? report.main)!)}\n${errors.join("\n")}\n</details>`;
}

export function getResultComments(main: Errors, branch: Errors, userToTag: string, logUrl: string): string[] {
  const maxLength = 65535;
  const footer = `\n\n[Full output in the log](${logUrl}).`;
  const firstHeader = `Hey @${userToTag}, the results of running the DT tests are ready.\n\nThere were interesting changes:`;
  const continuationHeader = `Hey @${userToTag}, here are more DT test results:`;
  const truncation = "\n\nThis package report was truncated; see the log for full output.";
  const comments: string[] = [];
  let header = firstHeader;
  let body = "";

  function flush() {
    comments.push(header + body + footer);
    header = continuationHeader;
    body = "";
  }

  for (const report of getDiffReports(main, branch)) {
    let rendered = formatReport(report);
    if (body && header.length + body.length + 2 + rendered.length + footer.length > maxLength) {
      flush();
    }
    const available = maxLength - header.length - 2 - footer.length;
    if (rendered.length > available) {
      // Truncate source text, never serialized HTML (which could split an entity or a link).
      let low = 0;
      let high = Math.max(report.main?.error.length ?? 0, report.branch?.error.length ?? 0);
      if (formatReport(report, 0).length + truncation.length > available) {
        throw new Error("Package report metadata exceeds the GitHub comment size limit.");
      }
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (formatReport(report, mid).length + truncation.length <= available) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      rendered = formatReport(report, low) + truncation;
    }
    body += "\n\n" + rendered;
  }
  if (body) {
    flush();
  }
  return comments;
}

export function getDiffLog(main: Errors, branch: Errors): string {
  return formatDiffLog(getDiffReports(main, branch));
}

function formatDiffLog(reports: DiffReport[]): string {
  return reports
    .map((report) => {
      const lines = [report.title];
      for (const [label, failure] of [
        ["Main", report.main],
        ["Branch", report.branch],
      ] as const) {
        if (!failure) continue;
        lines.push(`Package: ${failure.path}`, ...(failure.packageUrl ? [failure.packageUrl] : []), `${label} error:`);
        for (const project of failure.projects ?? []) {
          lines.push(`Project: ${project.path}`, project.url);
        }
        lines.push(failure.error);
        for (const location of failure.errorLinks ?? []) {
          lines.push(`${failure.error.slice(location.start, location.end)} -> ${location.url}`);
        }
      }
      // Azure recognizes logging commands even when they aren't at the start of a line.
      return lines
        .join("\n")
        .replace(/##(?=vso\[|\[)/gi, "# #")
        .split(/\r?\n/)
        .map((line) => `  ${line}`)
        .join("\n");
    })
    .join("\n\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function link(text: string, url: string | undefined): string {
  const escaped = escapeHtml(text);
  return url?.startsWith("https://github.com/DefinitelyTyped/DefinitelyTyped/")
    ? `<a href="${escapeHtml(url)}">${escaped}</a>`
    : escaped;
}

function formatPackage(error: Failure): string {
  return `Package: <code>${link(error.path, error.packageUrl)}</code>\n`;
}

function formatProjects(error: Failure): string {
  const projects = error.projects ?? [];
  return projects.length
    ? `\nProject scope: ${projects.map((project) => `<code>${link(project.path, project.url)}</code>`).join(", ")}\n\n`
    : "";
}

function formatError(error: Failure, maxLength = Infinity): string {
  let end = Math.min(error.error.length, maxLength);
  if (end > 0 && /[\uD800-\uDBFF]/.test(error.error[end - 1])) {
    end--;
  }
  let result = "";
  let start = 0;
  for (const location of error.errorLinks ?? []) {
    if (location.end > end) break;
    result += escapeHtml(error.error.slice(start, location.start));
    result += link(error.error.slice(location.start, location.end), location.url);
    start = location.end;
  }
  result += escapeHtml(error.error.slice(start, end));
  if (end < error.error.length) result += "\n[... truncated ...]";
  // Fenced code blocks don't render links; HTML preserves both whitespace and clickable locations.
  return `<pre>${result}</pre>\n`;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

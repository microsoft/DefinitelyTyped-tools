import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import glob = require("glob");

type Errors = { path: string; error: string }[];

// Args: [auth token] [buildId] [status comment] [user to tag] [issue] [job status] [?nightly errors file] [?branch errors file]
async function main() {
  const [auth, buildId, statusCommentId, userToTag, issue, status, nightlyErrorsPath, branchErrorsPath] =
    process.argv.slice(2);
  if (!auth) throw new Error("First argument must be a GitHub auth token.");
  if (!buildId) throw new Error("Second argument must be a build id.");
  if (!statusCommentId) throw new Error("Third argument must be a GitHub comment id.");
  if (!userToTag) throw new Error("Fourth argument must be a GitHub username.");
  if (!issue) throw new Error("Fifth argument must be a TypeScript issue/PR number.");
  if (!status) throw new Error("Sixth argument must be a status ('ok' or 'fail').");

  const gh = new Octokit({ auth });
  const checkLogsMessage = `\n[You can check the log here](https://typescript.visualstudio.com/TypeScript/_build/index?buildId=${buildId}&_a=summary).`;

  try {
    let newComment;
    if (status === "fail") {
      newComment =
        `Hey @${userToTag}, it looks like the DT test run failed. Please check the log for more details.` +
        checkLogsMessage;
    } else {
      const nightlyErrors: Errors = [];
      if (nightlyErrorsPath) {
        const nightlyFiles = glob.sync(`**/*.json`, { cwd: nightlyErrorsPath, absolute: true });
        for (const file of nightlyFiles) {
          nightlyErrors.push(...(JSON.parse(readFileSync(file, "utf-8")) as Errors));
        }
      }
      const branchErrors: Errors = [];
      if (branchErrorsPath) {
        const branchFiles = glob.sync(`**/*.json`, { cwd: branchErrorsPath, absolute: true });
        for (const file of branchFiles) {
          branchErrors.push(...(JSON.parse(readFileSync(file, "utf-8")) as Errors));
        }
      }

      newComment = `Hey @${userToTag}, the results of running the DT tests are ready.\n`;
      const diffComment = getDiffComment(nightlyErrors, branchErrors);
      if (diffComment) {
        newComment += `There were interesting changes:\n`;
        if (newComment.length + diffComment.length + checkLogsMessage.length > 65535) {
          newComment += `Changes are too big to display here, please check the log.`;
        } else {
          newComment += diffComment;
        }
      } else {
        newComment += "Everything looks the same!";
      }
      newComment += checkLogsMessage;
    }

    const response = await gh.issues.createComment({
      issue_number: +issue,
      owner: "Microsoft",
      repo: "TypeScript",
      body: newComment,
    });

    const newCommentUrl = response.data.html_url;
    const statusComment = await gh.issues.getComment({
      owner: "Microsoft",
      repo: "TypeScript",
      comment_id: +statusCommentId,
    });

    const newBody = `${statusComment.data.body}\n\nUpdate: [The results are in!](${newCommentUrl})`;
    await gh.issues.updateComment({
      owner: "Microsoft",
      repo: "TypeScript",
      comment_id: +statusCommentId,
      body: newBody,
    });
  } catch (e) {
    console.error(e);
    await gh.issues.createComment({
      issue_number: +issue,
      owner: "Microsoft",
      repo: "TypeScript",
      body: `Hey @${userToTag}, something went wrong when publishing results from the DT run.` + checkLogsMessage,
    });
  }
}

function getDiffComment(nightly: Errors, branch: Errors): string | undefined {
  const nightlyMap = new Map(nightly.map((error) => [error.path, error]));
  const branchMap = new Map(branch.map((error) => [error.path, error]));

  const nightlyOnly = [];
  const bothChanged = [];
  const branchOnly = [];

  for (const [path, error] of nightlyMap) {
    if (branchMap.has(path)) {
      const branchError = branchMap.get(path)!;
      if (branchError.error !== error.error) {
        bothChanged.push({ path, nightlyError: error.error, branchError: branchError.error });
      }
    } else {
      nightlyOnly.push(error);
    }
  }

  for (const [path, error] of branchMap) {
    if (nightlyMap.has(path)) {
      continue; // Already considered above
    } else {
      branchOnly.push(error);
    }
  }

  if (!nightlyOnly.length && !bothChanged.length && !branchOnly.length) {
    return undefined;
  }

  const branchOnlyMessage = branchOnly.length
    ? `
<details>
<summary>Branch only errors:</summary>

${branchOnly.map((err) => `Package: ${err.path}\nError:\n\`\`\`\n${err.error}\n\`\`\``).join("\n\n")}
</details>
`
    : "";
  const nightlyOnlyMessage = nightlyOnly.length
    ? `
<details>
<summary>Nightly only errors:</summary>

${nightlyOnly.map((err) => `Package: ${err.path}\nError:\n\`\`\`\n${err.error}\n\`\`\``).join("\n\n")}
</details>
`
    : "";
  const bothChangedMessage = bothChanged.length
    ? `
<details>
<summary>Errors that changed:</summary>

${bothChanged
  .map(
    (err) =>
      `Package: ${err.path}\nNightly error:\n\`\`\`\n${err.nightlyError}\n\`\`\`\nBranch error:\n\`\`\`\n${err.branchError}\n\`\`\``
  )
  .join("\n\n")}
</details>
`
    : "";

  return branchOnlyMessage + bothChangedMessage + nightlyOnlyMessage;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

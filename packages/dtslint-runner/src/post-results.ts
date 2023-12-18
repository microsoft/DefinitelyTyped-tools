import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
import glob = require("glob");

type Errors = { path: string; error: string }[];

// Args: [auth token] [buildId] [status comment] [user to tag] [issue] [job status] [?main errors file] [?branch errors file]
async function main() {
  const [auth, buildId, statusCommentId, userToTag, issue, status, mainErrorsPath, branchErrorsPath] =
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

      newComment = `Hey @${userToTag}, the results of running the DT tests are ready.\n`;
      const diffComment = getDiffComment(mainErrors, branchErrors);
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

function getDiffComment(main: Errors, branch: Errors): string | undefined {
  const mainMap = new Map(main.map((error) => [error.path, error]));
  const branchMap = new Map(branch.map((error) => [error.path, error]));

  const mainOnly = [];
  const bothChanged = [];
  const branchOnly = [];

  for (const [path, error] of mainMap) {
    if (branchMap.has(path)) {
      const branchError = branchMap.get(path)!;
      if (branchError.error !== error.error) {
        bothChanged.push({ path, mainError: error.error, branchError: branchError.error });
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

  if (!mainOnly.length && !bothChanged.length && !branchOnly.length) {
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
  const mainOnlyMessage = mainOnly.length
    ? `
<details>
<summary>Main only errors:</summary>

${mainOnly.map((err) => `Package: ${err.path}\nError:\n\`\`\`\n${err.error}\n\`\`\``).join("\n\n")}
</details>
`
    : "";
  const bothChangedMessage = bothChanged.length
    ? `
<details>
<summary>Errors that changed between main and the branch:</summary>

${bothChanged
  .map(
    (err) =>
      `Package: ${err.path}\nMain error:\n\`\`\`\n${err.mainError}\n\`\`\`\nBranch error:\n\`\`\`\n${err.branchError}\n\`\`\``,
  )
  .join("\n\n")}
</details>
`
    : "";

  return branchOnlyMessage + bothChangedMessage + mainOnlyMessage;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { Octokit } from "@octokit/rest";
import { readdirSync, readFileSync } from "fs";

type Errors = { path: string, message: string }[];

// Args: [jobs] [auth token] [buildId] [status comment] [user to tag] [issue] [?nightly errors file] [?branch errors file]
async function main() {
  const [jobs, auth, buildId, statusCommentId, userToTag, issue, nightlyErrorsPath, branchErrorsPath] = process.argv.slice(2);
  if (!jobs) throw new Error("First argument must be the number of jobs.")
  if (!auth) throw new Error("Second argument must be a GitHub auth token.");
  if (!buildId) throw new Error("Third argument must be a build id.");
  if (!statusCommentId) throw new Error("Fourth argument must be a GitHub comment id.");
  if (!userToTag) throw new Error("Fifth argument must be a GitHub username.");
  if (!issue) throw new Error("Sixth argument must be a TypeScript issue/PR number.");

  const gh = new Octokit({ auth });

  const nightlyErrors: Errors = [];
  if (nightlyErrorsPath) {
    const nightlyFiles = readdirSync(nightlyErrorsPath, { encoding: "utf-8"});
    for (const file in nightlyFiles) {
      nightlyErrors.push(...JSON.parse(readFileSync(file, "utf-8")) as Errors);
    }
  }
  const branchErrors: Errors = [];
  if (branchErrorsPath) {
    const branchFiles = readdirSync(branchErrorsPath, { encoding: "utf-8"});
    for (const file in branchFiles) {
      branchErrors.push(...JSON.parse(readFileSync(file, "utf-8")) as Errors);
    }
  }
  
  const checkLogsMessage = `([You can check the log here](https://typescript.visualstudio.com/TypeScript/_build/index?buildId=${buildId}&_a=summary).`;
  try {
    let comment = `@${userToTag} the results of running the DT tests are ready.`;
    const diffComment = getDiffComment(nightlyErrors, branchErrors);
    if (diffComment) {
      comment += `\nThere were interesting changes:`
      if (comment.length + diffComment.length + checkLogsMessage.length > 65535) {
        comment += `\nChanges are too big to display here, please check the log.`
      }
      else {
        comment += diffComment;
      }
    }
    else {
      comment += "Everything looks the same!"
    }
    comment += checkLogsMessage;
    const response = await gh.issues.createComment({
      issue_number: +issue,
      owner: "Microsoft",
      repo: "TypeScript",
      body: comment
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
      body: newBody
    });
  }
  catch (e) {
    await gh.issues.createComment({
      issue_number: +issue,
      owner: "Microsoft",
      repo: "TypeScript",
      body: `Hey @${userToTag}, something went wrong when publishing results.` + checkLogsMessage // >> TODO: edit this
    });
  }
}

function getDiffComment(nightly: Errors, branch: Errors): string | undefined {
  const nightlyMap = new Map(nightly.map(error => [error.path, error]));
  const branchMap = new Map(branch.map(error => [error.path, error]));

  const nightlyOnly = [];
  const bothChanged = [];

  for (const [path, error] of nightlyMap) {
    if (branchMap.has(path)) {
      const branchError = branchMap.get(path)!;
      if (branchError.message !== error.message) {
        bothChanged.push({ path, nightly: error.message, branch: branchError.message });
      }
    }
    else {
      nightlyOnly.push(error)
    }
  }

  const branchOnly = [];
  for (const [path, error] of branchMap) {
    if (nightlyMap.has(path)) {
      continue; // Already considered above
    }
    else {
      branchOnly.push(error)
    }
  }

  if (!nightlyOnly.length && !bothChanged.length && !branchOnly.length) {
    return undefined;
  }

  const nightlyOnlyMessage =
    nightlyOnly.length ? `
<details>
<summary>Nightly only errors:</summary>
${nightlyOnly.map(err => `Package: ${err.path}\nError: ${err.message}`).join("\n")}
</details>
` : "";
  const bothChangedMessage =
    bothChanged.length ? `
<details>
<summary>Errors that changed:</summary>
${bothChanged.map(err => `Package: ${err.path}\nNightly error: ${err.nightly}\nBranch error: ${err.branch}`).join("\n")}
</details>
` : "";
  const branchOnlyMessage =
    branchOnly.length ? `
<details>
<summary>Branch only errors:</summary>
${branchOnly.map(err => `Package: ${err.path}\nError: ${err.message}`).join("\n")}
</details>
` : "";

  return nightlyOnlyMessage + bothChangedMessage + branchOnlyMessage;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
import { Octokit } from "@octokit/rest";
import { config } from "../common";
import { OverallChange } from "../analysis";

const commentTagStart = "<!-- @dt-perf ";
const commentTagEnd = " -->";

function assertCommentSafe(str: string) {
  if (str.includes("-->")) {
    throw new Error("Data is unsafe to serialize in HTML comment");
  }
  return str;
}

export interface CommentData {
  overallChange?: OverallChange;
}

export function createPerfCommentBody(data: CommentData, body: string): string {
  return [commentTagStart + assertCommentSafe(JSON.stringify({ version: 2, data })) + commentTagEnd, "", body].join(
    "\n"
  );
}

export function isPerfComment({ body, user }: Pick<Octokit.IssuesListCommentsResponseItem, "body" | "user">): boolean {
  return user.login === config.github.typeScriptBotUsername && body.trimLeft().startsWith(commentTagStart);
}

export function getCommentData(
  comment: Pick<Octokit.IssuesListCommentsResponseItem, "body" | "user">
): CommentData | undefined {
  if (isPerfComment(comment)) {
    try {
      const trimmed = comment.body.trimLeft();
      const dataText = trimmed
        .substring(commentTagStart.length)
        .substring(0, trimmed.indexOf(commentTagEnd) - commentTagStart.length);
      return JSON.parse(dataText).data;
    } catch {
      return undefined;
    }
  }
  return;
}

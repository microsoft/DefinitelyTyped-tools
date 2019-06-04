import { IssuesListCommentsResponseItem } from "@octokit/rest";
import { config } from "../common";

const commentTagStart = '<!-- @dt-perf';

export function createPerfCommentBody(body: string): string {
  return [
    commentTagStart + ` -->`,
    ``,
    body,
  ].join('\n');
}

export function isPerfComment({ body, user }: Pick<IssuesListCommentsResponseItem, 'body' | 'user'>): boolean {
  return user.login === config.github.typeScriptBotUsername
    && body.trimLeft().startsWith(commentTagStart);
}

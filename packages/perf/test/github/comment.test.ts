import { createPerfCommentBody, getCommentData } from "../../src/github/comment";
import { OverallChange } from "../../src/analysis";
import { config } from "../../src/common";
import { IssuesListResponseItemUser } from "@octokit/rest";

describe("github", () => {
  describe("comment", () => {
    it("serializes -> deserializes correctly", () => {
      const data = { benchmarks: [], overallChange: OverallChange.Better };
      const commentBody = createPerfCommentBody(data, "\n\nHello");
      expect(
        getCommentData({
          body: commentBody,
          user: { login: config.github.typeScriptBotUsername } as IssuesListResponseItemUser
        })
      ).toEqual(data);
    });
  });
});

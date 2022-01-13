import { assertDefined } from "@definitelytyped/utils";

export const config = {
  benchmarks: {
    languageServiceIterations: 5
  },
  github: {
    userAgent: "definitely-not-slow",
    typeScriptBotUsername: "typescript-bot",
    get typeScriptBotAuthToken() {
      return assertDefined(
        process.env.TYPESCRIPT_BOT_GITHUB_TOKEN,
        `Required environment variable 'TYPESCRIPT_BOT_GITHUB_TOKEN' was not set`
      );
    },
    commonParams: {
      owner: "DefinitelyTyped",
      repo: "DefinitelyTyped"
    }
  },
  comparison: {
    percentDiffWarningThreshold: 0.2,
    percentDiffAlertThreshold: 1,
    percentDiffAwesomeThreshold: -0.25
  }
};

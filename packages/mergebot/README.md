This is the bot that controls the workflow of Definitely Typed PRs.

## Meta

* __State:__ Production
* __Dashboard:__ [Azure](https://ms.portal.azure.com/#@72f988bf-86f1-41af-91ab-2d7cd011db47/resource/subscriptions/57bfeeed-c34a-4ffd-a06b-ccff27ac91b8/resourceGroups/dtmergebot/providers/Microsoft.Web/sites/DTMergeBot) — [Logs](https://ms.portal.azure.com/#blade/WebsitesExtension/FunctionsIFrameBlade/id/%2Fsubscriptions%2F57bfeeed-c34a-4ffd-a06b-ccff27ac91b8%2FresourceGroups%2Fdtmergebot%2Fproviders%2FMicrosoft.Web%2Fsites%2FDTMergeBot) — [GH Actions](https://github.com/microsoft/DefinitelyTyped-tools/actions) — [GH Webhook](https://github.com/DefinitelyTyped/DefinitelyTyped/settings/hooks/193097250)

TODO: Update these links for dtmergebot2

It is both a series of command line scripts which you can use to test different states, and an Azure Function App which handles incoming webhooks from the DefinitelyTyped repo.

This repo is deployed to Azure on every push to master.
To ensure we can handle timeouts on older PRs, there is a [GitHub Action](https://github.com/microsoft/DefinitelyTyped-tools/actions) that runs the bot every 6 hours against [all open PRs](./src/run.ts), and has a bunch of useful flags for running manually too.

# Setup

```sh
# Clone it
git clone https://github.com/microsoft/DefinitelyTyped-tools.git
cd DefinitelyTyped-tools

# Deps
pnpm install

# Validate it works
pnpm test
```

# How the app works

There are three main stages once the app has a PR number:

* Query the GitHub GraphQL API for PR metadata ([`pr-info`](src/pr-info.ts))
* Create a PR actions metadata object ([`compute-pr-actions`](src/compute-pr-actions.ts))
* Do work based on the resulting actions ([`execute-pr-actions`](src/execute-pr-actions.ts))

# How the bot works

There is an Azure function in `PR-Trigger` that receives webhooks; this function's job is to find the PR number then it runs the above steps.

# Running Locally

You _probably_ don't need to do this. Use test to validate any change inside the src dir against integration tests.

However, you need to have a GitHub API access key in either: `DT_BOT_AUTH_TOKEN`, `BOT_AUTH_TOKEN` or `AUTH_TOKEN`.
Ask Ryan for the bot's auth token (TypeScript team members: Look in the team OneNote).
Don't run the bot under your own auth token as this will generate a bunch of spam from duplicate comments.

```sh
# Windows
set BOT_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# *nix
export BOT_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then to run locally you'll need to install the [Azure Functions cli](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Ccsharp%2Cbash).

# Development

```sh
# Build
pnpm run build

# Run the CLI to see what would happen to an existing PR
pnpm run single-info -- [PR_NUM]
# or
pnpm run single-info-debug -- [PR_NUM]
```

### If you update any queries

Run this to update the generate types:

```sh
# Code-gen the schema
pnpm run graphql-schema
```

### If you change project columns or labels

Run this to update the cached values:

```sh
# Regenerate src/_tests/cachedQueries.json
pnpm run update-test-data
```

# Tests

```sh
# Run tests, TypeScript is transpiled at runtime
pnpm test
```

Most of the tests run against a fixtured PR, these are high level integration tests that store the PR info and then re-run the latter two phases of the app.

To create fixtures of a current PR:

```sh
# To create a fixture for PR 43161
pnpm run create-fixture -- 43161
```

Then you can work against these fixtures offline with:

```sh
# Watch mode for all tests
pnpm test -- --watch
# Just run fixtures for one PR
pnpm test -- --testNamePattern 44299
```

Run a test with the debugger:

```sh
node --inspect --inspect-brk ./node_modules/.bin/jest -i --runInBand --testNamePattern 44299
```

Then use "Attach to Process ID" to connect to that test runner

If your changes require re-creating all fixtures:

```sh
pnpm run update-all-fixtures
```

Be careful with this, because PRs may now be in a different state e.g. it's now merged and it used to be a specific
weird state.

## Running with real webhooks

You need a tool like [ngrok](https://ngrok.com) to expose a URL from the [webhooks section](https://github.com/DefinitelyTyped/DefinitelyTyped/settings/hooks/new) on DT. 

Start two terminal sessions with:

- `yarn watch` (for TypeScript changes)
- `yarn start` (for the app)

Then start a third with your localhost router like ngrok:

- `ngrok http 7071`

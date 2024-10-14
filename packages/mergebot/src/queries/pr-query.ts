import { gql, TypedDocumentNode } from "@apollo/client/core";
import { client } from "../graphql-client";
import { PR, PRVariables, PR_repository_pullRequest_files_nodes } from "./schema/PR";
import { PRFiles, PRFilesVariables } from "./schema/PRFiles";
import { noNullish } from "../util/util";

export const fileLimit = 500;

// Note: If you want to work on this in local a copy of GraphiQL:
// - Download the electron app: https://github.com/skevy/graphiql-app/releases
// - Then set the headers:
//     authorization: Bearer [token]
//     accept: application/vnd.github.starfox-preview+json (if needed)
// - Finally set the endpoint: https://api.github.com/graphql
// - Now you're good to C&P the query below

/** This is a GraphQL AST tree */
const getPRInfoQueryFirst: TypedDocumentNode<PR, PRVariables> = gql`
  query PR($prNumber: Int!) {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      id
      pullRequest(number: $prNumber) {
        id
        title
        createdAt
        author {
          login
        }
        authorAssociation
        baseRef {
          name
        }
        labels(first: 100) {
          nodes {
            name
          }
        }
        isDraft
        mergeable
        number
        state
        headRefOid
        changedFiles
        additions
        deletions

        commitIds: commits(last: 100) {
          nodes {
            commit {
              oid
              parents(first: 3) {
                nodes {
                  oid
                }
              }
            }
          }
        }

        timelineItems(last: 200, itemTypes: [REOPENED_EVENT, READY_FOR_REVIEW_EVENT, MOVED_COLUMNS_IN_PROJECT_EVENT]) {
          nodes {
            ... on ReopenedEvent {
              createdAt
            }
            ... on ReadyForReviewEvent {
              createdAt
            }
            ... on MovedColumnsInProjectEvent {
              actor {
                login
              }
              createdAt
              projectColumnName
            }
          }
        }

        reviews(last: 100) {
          nodes {
            author {
              login
            }
            commit {
              oid
            }
            comments(last: 10) {
              nodes {
                author {
                  login
                }
                createdAt
              }
            }
            authorAssociation
            state
            submittedAt
            url
          }
        }

        commits(last: 1) {
          totalCount
          nodes {
            commit {
              checkSuites(first: 100) {
                nodes {
                  databaseId
                  app {
                    name
                  }
                  conclusion
                  resourcePath
                  status
                  url
                  checkRuns(last: 1) {
                    nodes {
                      title
                    }
                  }
                  createdAt
                  workflowRun {
                    file {
                      path
                    }
                  }
                }
              }
              status {
                state
                contexts {
                  state
                  description
                  creator {
                    login
                  }
                  targetUrl
                }
              }
              authoredDate
              committedDate
              pushedDate
              oid
            }
          }
        }

        comments(last: 100) {
          totalCount
          nodes {
            id
            author {
              login
            }
            databaseId
            body
            createdAt
            reactions(first: 100, content: THUMBS_UP) {
              nodes {
                user {
                  login
                }
              }
            }
          }
        }

        files(first: 100) {
          totalCount
          nodes {
            path
            additions
            deletions
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }

        projectItems(first: 10) {
          nodes {
            id
            project {
              id
              number
            }
            fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                  }
                }
              }
            }
            updatedAt
          }
        }
      }
    }
  }
`;
export async function getPRInfo(prNumber: number) {
  const info = await getPRInfoFirst(prNumber);
  const prInfo = info.data.repository?.pullRequest;
  // reasons to not bother with getting all files:
  if (!prInfo) return info; // ... bad results (see below)
  if (prInfo.isDraft) return info; // ... draft PRs
  if (!prInfo.files) throw new Error("internal error while fetching PR info");
  const { hasNextPage, endCursor } = prInfo.files.pageInfo;
  if (!(hasNextPage && endCursor)) return info; // ... got all
  // otherwise get the rest
  prInfo.files.nodes = noNullish(prInfo.files.nodes);
  await getPRInfoRest(prNumber, endCursor, prInfo.files.nodes);
  return info;
}

async function getPRInfoFirst(prNumber: number) {
  // The query can return a mergeable value of `UNKNOWN`, and then it takes a
  // while to get the actual value while GH refreshes the state (verified
  // with GH that this is expected).  So implement a simple retry thing to
  // get a proper value, or return a useless one if giving up.
  let retries = 0;
  while (true) {
    const info = await client.query({
      query: getPRInfoQueryFirst,
      variables: { prNumber },
      fetchPolicy: "no-cache",
    });
    const prInfo = info.data.repository?.pullRequest;
    if (!prInfo) return info; // let `deriveStateForPR` handle the missing result
    if (!(prInfo.state === "OPEN" && prInfo.mergeable === "UNKNOWN")) return info;
    if (++retries > 5) {
      // we already did 5 tries, so give up and...
      info.data.repository = null;
      return info; // ...return a bad result to avoid using the bogus information
    }
    // wait 3N..3N+1 seconds (based on trial runs: it usually works after one wait)
    const wait = 1000 * (Math.random() + 3 * retries);
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
}

// Repeat just the file part, since that's all we need here
const getPRInfoQueryRest: TypedDocumentNode<PRFiles, PRFilesVariables> = gql`
  query PRFiles($prNumber: Int!, $endCursor: String) {
    repository(owner: "DefinitelyTyped", name: "DefinitelyTyped") {
      pullRequest(number: $prNumber) {
        files(first: 100, after: $endCursor) {
          totalCount
          nodes {
            path
            additions
            deletions
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

async function getPRInfoRest(
  prNumber: number,
  endCursor: string | null,
  files: (PR_repository_pullRequest_files_nodes | null)[],
) {
  while (true) {
    const result = await client.query({
      query: getPRInfoQueryRest,
      variables: { prNumber, endCursor },
      fetchPolicy: "no-cache",
    });
    const newFiles = result.data.repository?.pullRequest?.files;
    if (!newFiles) return;
    files.push(...noNullish(newFiles.nodes));
    if (files.length >= fileLimit || !newFiles.pageInfo.hasNextPage) return;
    endCursor = newFiles.pageInfo.endCursor;
  }
}

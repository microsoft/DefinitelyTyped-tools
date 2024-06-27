
DefinitelyTyped PRs are now subject to the following constraints to improve throughput and reduce latency.

## Terms

### Unmergeable

A PR is *unmergeable* if any of the following are true:
 * It contains merge conflicts (the `Has Merge Conflict` label will be applied)
 * It is failing the CI build (the `The CI build failed` label will be applied)
 * It has unaddressed comments from code reviewers (the `Revision needed`) will be applied

### Mergeable

A PR is *mergeable* if it is not *unmergeable*.

### Passing Code Review

A user has submitted a *passing code review* if they:
 * :+1: `dt-bot`'s comment
 * Post a comment containing :+1:
 * Use GitHub's "review" feature and Approve

### Definition Author

A *definition author* is a user listed in the `index.d.ts` file authors list.
These users are assumed to have appropriate knowledge of the file and are considered trustworthy reviewers.

DT maintainers may treat themselves as definition authors at their discretion.

### Express Merge

A PR is available to *express merge* if:
 * The PR is *mergeable*
 * The PR has a *passing review* from a *definition author*

An *express merge* may occur immediately and automatically.

### LGTM Merge

A PR is available to *LGTM merge* if:
 * The PR is *mergeable*
 * The PR has a *passing review* from anyone
 * Three days have elapsed since the PR code was last changed

*LGTM merges* will occur manually at DT maintainers' discretion.

### YSYL (You Snooze You Lose) Merge

A PR is available to *YSYL merge* if:
 * The PR is *mergeable*
 * No one has left a review with concrete next steps
 * Five days have elapsed since the PR code was last changed

*YSYL merges* will occur manually at DT maintainers' discretion.

### Abandoned

A PR is *abandoned* if:
 * It is *unmergeable*
 * The author has not commented on the PR in seven days
 * The author has not pushed commits to the PR in seven days

Abandoned PRs will be automatically closed.

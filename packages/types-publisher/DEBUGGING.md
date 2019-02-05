# DEBUGGING

Debugging an Azure App Service has been a miserable learning
experience for me, so here are some tips to help.

First, repro and debug anything you can locally. Everything except the
webhook-server either includes a dry-run mode or runs identically
locally. But you may still need to test the non-dry-run code.

Your basic workflow looks like this:

1. `npm run push-production`
2. Resend webhook or merge a new PR.
3. Look at ftp logs.

(2) and (3) have some complexity.

Step (2) is required because an App Service doesn't seem to properly
restart until a web request comes in. If you're just testing startup,
or something else that happens even if no PRs need to be merged,
resending a webhook should be fine. Types-publisher only cares that
the push was to master and not to some other branch. This is true for
all non-team-member PRs.

Otherwise, you'll need to find a easy PR to merge.

For step (3), proceed to the FTP logs. If you can't remember the
address, you can find it in the Diagnostics logs section of the
TypesPublisher App Service page on Azure. You can also set up new
username/password combinations somewhere, but I don't remember where
exactly. I think the README may tell where.

Then look in LogFiles/Application/ and page down to index.html, which
contains a *sorted* list of log files. You'll see a new log file
every time the server restarts, which is at least every time you push
to production, but may be more often if the server is crashing.
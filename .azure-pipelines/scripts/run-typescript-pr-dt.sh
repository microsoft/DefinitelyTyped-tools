#!/usr/bin/env bash

set -euo pipefail

: "${PIPELINE_WORKSPACE:?}"
: "${SHARD_COUNT:?}"
: "${SHARD_ID:?}"

label=${1:?Usage: $0 PR|main}
case "$label" in
    PR)
        root="$PIPELINE_WORKSPACE/pr"
        failures="$root/prFailures${SHARD_ID}.json"
        ;;
    main)
        root="$PIPELINE_WORKSPACE/main"
        failures="$root/mainFailures${SHARD_ID}.json"
        ;;
    *)
        echo "Unknown run label: $label" >&2
        exit 1
        ;;
esac

tools_path="$PIPELINE_WORKSPACE/s/DefinitelyTyped-tools"
typescript_path="$PIPELINE_WORKSPACE/s/TypeScript"
local_typescript_path="$typescript_path/packages/typescript"
dt_path="$PIPELINE_WORKSPACE/s/DefinitelyTyped"
errors="$root/errors.txt"

mkdir -p "$root"
echo "$label run: Shard $SHARD_ID of $SHARD_COUNT"
echo "dtslint runner: $tools_path/packages/dtslint-runner/dist/index.js"

pushd "$dt_path" >/dev/null
set +o pipefail
node "$tools_path/packages/dtslint-runner/dist/index.js" \
    --path . \
    --localTypeScriptPath "$local_typescript_path" \
    --selection all \
    --expectOnly \
    --shardId "$SHARD_ID" \
    --shardCount "$SHARD_COUNT" \
    --writeFailures "$failures" 3>&1 1>&2 2>&3 | tee -a "$errors"
set -o pipefail
popd >/dev/null

node "$tools_path/packages/dtslint-runner/dist/add-github-links.js" "$failures" "$dt_path"

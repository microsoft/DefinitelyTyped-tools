#!/usr/bin/env bash

set -euo pipefail

: "${DT_SHA:?}"
: "${EXPECTED_BASE_SHA:?}"
: "${EXPECTED_HEAD_SHA:?}"
: "${EXPECTED_MERGE_SHA:?}"
: "${PIPELINE_WORKSPACE:?}"
: "${SHARD_COUNT:?}"
: "${SHARD_ID:?}"
: "${TYPESCRIPT_PATH:?}"

actual_merge_sha=$(git -C "$TYPESCRIPT_PATH" rev-parse HEAD)
actual_base_sha=$(git -C "$TYPESCRIPT_PATH" rev-parse HEAD^1)
actual_head_sha=$(git -C "$TYPESCRIPT_PATH" rev-parse HEAD^2)

verify_sha() {
    local label=$1
    local actual=$2
    local expected=$3
    if [[ "$actual" != "$expected" ]]; then
        echo "$label SHA mismatch: expected $expected, got $actual" >&2
        exit 1
    fi
}

verify_sha merge "$actual_merge_sha" "$EXPECTED_MERGE_SHA"
verify_sha base "$actual_base_sha" "$EXPECTED_BASE_SHA"
verify_sha head "$actual_head_sha" "$EXPECTED_HEAD_SHA"

install_typescript() {
    if [[ -f package-lock.json ]]; then
        npm ci
    else
        npm install
    fi
}

build_typescript() {
    if [[ -d tsc ]]; then
        npm run build
        npx hereby build:api
        local_typescript_path="$TYPESCRIPT_PATH/packages/typescript"
    else
        npm run build:compiler
        local_typescript_path="$TYPESCRIPT_PATH/built/local"
    fi
}

run_dtslint() {
    local label=$1
    local root=$2
    local failures=$3
    local errors="$root/errors.txt"

    mkdir -p "$root"
    echo "$label run: Shard $SHARD_ID of $SHARD_COUNT"

    pushd "$dt_path" >/dev/null
    set +o pipefail
    pnpm dtslint-runner \
        --path . \
        --localTypeScriptPath "$local_typescript_path" \
        --selection all \
        --expectOnly \
        --shardId "$SHARD_ID" \
        --shardCount "$SHARD_COUNT" \
        --writeFailures "$failures" 3>&1 1>&2 2>&3 | tee -a "$errors"
    set -o pipefail
    popd >/dev/null
}

git config --global core.longpaths true

pushd "$TYPESCRIPT_PATH" >/dev/null
install_typescript
build_typescript
popd >/dev/null

dt_path="$PIPELINE_WORKSPACE/DefinitelyTyped"
git clone --filter=blob:none https://github.com/DefinitelyTyped/DefinitelyTyped.git "$dt_path"
git -C "$dt_path" switch --detach "$DT_SHA"
pushd "$dt_path" >/dev/null
npm install --global "$(jq -r '.packageManager' package.json)"
pnpm install
popd >/dev/null

run_dtslint \
    PR \
    "$PIPELINE_WORKSPACE/pr" \
    "$PIPELINE_WORKSPACE/pr/prFailures${SHARD_ID}.json"

git -C "$TYPESCRIPT_PATH" switch --detach HEAD^1
pushd "$TYPESCRIPT_PATH" >/dev/null
install_typescript
build_typescript
popd >/dev/null

run_dtslint \
    main \
    "$PIPELINE_WORKSPACE/main" \
    "$PIPELINE_WORKSPACE/main/mainFailures${SHARD_ID}.json"

pr_errors="$PIPELINE_WORKSPACE/pr/errors.txt"
main_errors="$PIPELINE_WORKSPACE/main/errors.txt"

echo
echo "=== Errors only in main ==="
diff --changed-group-format='%<' --unchanged-group-format='' "$main_errors" "$pr_errors" | grep -Ev '^(===|[12]>)' || true

echo
echo "=== Errors only in branch ==="
diff --changed-group-format='%>' --unchanged-group-format='' "$main_errors" "$pr_errors" | grep -Ev '^(===|[12]>)' || true

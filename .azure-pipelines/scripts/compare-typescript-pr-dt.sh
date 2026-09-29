#!/usr/bin/env bash

set -euo pipefail

: "${PIPELINE_WORKSPACE:?}"

pr_errors="$PIPELINE_WORKSPACE/pr/errors.txt"
main_errors="$PIPELINE_WORKSPACE/main/errors.txt"

echo
echo "=== Errors only in main ==="
diff --changed-group-format='%<' --unchanged-group-format='' "$main_errors" "$pr_errors" | grep -Ev '^(===|[12]>)' || true

echo
echo "=== Errors only in branch ==="
diff --changed-group-format='%>' --unchanged-group-format='' "$main_errors" "$pr_errors" | grep -Ev '^(===|[12]>)' || true

#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  wait-ci.sh [--branch <branch>] [--mode <auto-fix|no-fix>]
EOF
}

BRANCH=""
MODE="auto-fix"
RUN_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git branch --show-current)"
fi

if [[ "$MODE" != "auto-fix" && "$MODE" != "no-fix" ]]; then
  echo "--mode must be one of: auto-fix, no-fix" >&2
  exit 1
fi

for _ in $(seq 1 20); do
  RUN_ID="$(gh run list \
    --branch "$BRANCH" \
    --workflow CI \
    --event pull_request \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId')"

  if [[ -n "$RUN_ID" && "$RUN_ID" != "null" ]]; then
    break
  fi

  sleep 3
done

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "No pull_request CI run found for branch '$BRANCH'." >&2
  exit 1
fi

echo "Watching CI run $RUN_ID for branch '$BRANCH' (mode: $MODE)"

if gh run watch "$RUN_ID" --exit-status; then
  echo "CI passed for branch '$BRANCH'."
  exit 0
fi

echo "CI failed for branch '$BRANCH'."
echo "Run summary:"
gh run view "$RUN_ID"
echo
echo "Failed step logs:"
gh run view "$RUN_ID" --log-failed || true

if [[ "$MODE" == "no-fix" ]]; then
  echo "Mode is no-fix; stopping after first CI failure." >&2
else
  echo "Mode is auto-fix; agent may inspect the failing step and apply allowed simple fixes." >&2
fi

exit 1

#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ship-pr.sh --message <conventional-commit> --files <path> [<path> ...] [options]

Options:
  --message <msg>       Conventional Commit message.
  --files <paths...>    Explicit list of files/paths to stage.
  --base <branch>       Base branch for the PR. Default: main.
  --branch <branch>     Target branch name. If omitted on base branch, derived from message.
  --title <title>       PR title. Default: commit message.
  --body-file <path>    Read PR body from file.
  --mode <mode>         auto-fix | no-fix. Default: auto-fix.
  --dry-run             Print planned actions without mutating git/GitHub state.
EOF
}

require_clean_index() {
  if ! git diff --cached --quiet; then
    echo "Refusing to proceed: index already has staged changes." >&2
    exit 1
  fi
}

slugify_message() {
  local raw="$1"
  printf '%s' "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/^[a-z]+(\([^)]+\))?!?:[[:space:]]*//' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

ensure_branch() {
  local current="$1"
  local base="$2"
  local requested="$3"
  local derived="$4"

  if [[ "$current" == "$base" ]]; then
    local target="${requested:-$derived}"
    git checkout -b "$target" >/dev/null
    printf '%s\n' "$target"
    return
  fi

  if [[ -n "$requested" && "$current" != "$requested" ]]; then
    echo "Current branch '$current' does not match requested branch '$requested'." >&2
    exit 1
  fi

  printf '%s\n' "$current"
}

MESSAGE=""
BASE_BRANCH="main"
TARGET_BRANCH=""
PR_TITLE=""
BODY_FILE=""
MODE="auto-fix"
DRY_RUN=0
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message)
      MESSAGE="${2:-}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --branch)
      TARGET_BRANCH="${2:-}"
      shift 2
      ;;
    --title)
      PR_TITLE="${2:-}"
      shift 2
      ;;
    --body-file)
      BODY_FILE="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --files)
      shift
      while [[ $# -gt 0 && "$1" != --* ]]; do
        FILES+=("$1")
        shift
      done
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

if [[ -z "$MESSAGE" ]]; then
  echo "--message is required." >&2
  usage >&2
  exit 1
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "--files must contain at least one path." >&2
  usage >&2
  exit 1
fi

if [[ "$MODE" != "auto-fix" && "$MODE" != "no-fix" ]]; then
  echo "--mode must be one of: auto-fix, no-fix" >&2
  exit 1
fi

if [[ -n "$BODY_FILE" && ! -f "$BODY_FILE" ]]; then
  echo "PR body file not found: $BODY_FILE" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
DERIVED_BRANCH="$(slugify_message "$MESSAGE")"

if [[ -z "$DERIVED_BRANCH" ]]; then
  echo "Could not derive branch name from message. Pass --branch explicitly." >&2
  exit 1
fi

if [[ -z "$PR_TITLE" ]]; then
  PR_TITLE="$MESSAGE"
fi

if (( DRY_RUN )); then
  if [[ "$CURRENT_BRANCH" == "$BASE_BRANCH" ]]; then
    EFFECTIVE_BRANCH="${TARGET_BRANCH:-$DERIVED_BRANCH}"
  else
    EFFECTIVE_BRANCH="${TARGET_BRANCH:-$CURRENT_BRANCH}"
  fi

  cat <<EOF
Mode: $MODE
Base branch: $BASE_BRANCH
Working branch: $CURRENT_BRANCH
Target branch: $EFFECTIVE_BRANCH
Commit message: $MESSAGE
PR title: $PR_TITLE
Files to stage:
$(printf '  %s\n' "${FILES[@]}")
EOF
  exit 0
fi

require_clean_index

EFFECTIVE_BRANCH="$(ensure_branch "$CURRENT_BRANCH" "$BASE_BRANCH" "$TARGET_BRANCH" "$DERIVED_BRANCH")"

git add -- "${FILES[@]}"

mapfile -t STAGED_FILES < <(git diff --cached --name-only)
if [[ ${#STAGED_FILES[@]} -eq 0 ]]; then
  echo "No staged changes after git add." >&2
  exit 1
fi

echo "Staged files:"
printf '  %s\n' "${STAGED_FILES[@]}"

git commit -m "$MESSAGE"
git push -u origin "$EFFECTIVE_BRANCH"

if gh pr view "$EFFECTIVE_BRANCH" >/dev/null 2>&1; then
  echo "PR already exists for branch '$EFFECTIVE_BRANCH'."
else
  if [[ -n "$BODY_FILE" ]]; then
    gh pr create --base "$BASE_BRANCH" --head "$EFFECTIVE_BRANCH" --title "$PR_TITLE" --body-file "$BODY_FILE"
  else
    gh pr create --base "$BASE_BRANCH" --head "$EFFECTIVE_BRANCH" --title "$PR_TITLE" --body "## Summary
- automated via scripts/agent/ship-pr.sh
"
  fi
fi

scripts/agent/wait-ci.sh --branch "$EFFECTIVE_BRANCH" --mode "$MODE"

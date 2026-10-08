#!/usr/bin/env bash
# Runs one batch: one headless builder per arm, all started together in a seeded random order.
# Usage: BASE_SHA=<sha> MODEL=<model> bench/run-batch.sh <task> <batch> [arm...]
# Arms: control caveman rtk ste rtk-emulated (default: control caveman rtk ste).
set -euo pipefail

BENCH_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$BENCH_DIR/.." && pwd)"
WORKDIR="${BENCH_WORKDIR:-$REPO/../ridetime-bench}"
RAW="$BENCH_DIR/results/raw"
TASK="${1:?task name, e.g. filmy}"
BATCH="${2:?batch number}"
shift 2
if (($#)); then ARMS=("$@"); else ARMS=(control caveman rtk ste); fi
: "${BASE_SHA:?set BASE_SHA - every run starts from the same commit}"
: "${MODEL:?set MODEL - every arm uses the same model}"
SEED="${SEED:-$TASK-$BATCH}"
export BENCH_DIR

TASK_FILE="$BENCH_DIR/tasks/$TASK.md"
[[ -f "$TASK_FILE" ]] || { echo "missing $TASK_FILE" >&2; exit 1; }
[[ -f "$BENCH_DIR/styles/.cache/caveman.md" ]] || { echo "run bench/styles/fetch.sh first" >&2; exit 1; }
mkdir -p "$WORKDIR" "$RAW"

style_file() {
  case "$1" in
    control) echo "$BENCH_DIR/styles/control.md" ;;
    rtk-emulated) echo "$BENCH_DIR/styles/rtk-emulated.md" ;;
    *) echo "$BENCH_DIR/styles/.cache/$1.md" ;;
  esac
}

if printf '%s\n' "${ARMS[@]}" | grep -qx rtk; then
  command -v rtk >/dev/null || { echo "arm 'rtk' needs the rtk binary on PATH (or use rtk-emulated)" >&2; exit 1; }
fi

PROMPT="$(cat "$TASK_FILE")

You work in the current directory, a git worktree on its own branch. Do not start a dev server. Commit your work. Do not push."

mapfile -t ORDER < <(printf '%s\n' "${ARMS[@]}" | shuf --random-source=<(yes "$SEED"))
echo "batch $BATCH ($TASK), seed '$SEED', order: ${ORDER[*]}"

# Prepare every worktree first, so all builders start at the same moment.
for ARM in "${ORDER[@]}"; do
  ID="$TASK-b$BATCH-$ARM"
  git -C "$REPO" worktree add -q -b "bench/$ID" "$WORKDIR/$ID" "$BASE_SHA"
  (cd "$WORKDIR/$ID" && npm ci --silent --no-audit --no-fund >/dev/null)
done

for ARM in "${ORDER[@]}"; do
  ID="$TASK-b$BATCH-$ARM"
  ARGS=(-p "$PROMPT" --model "$MODEL" --output-format stream-json --verbose
    --allowedTools "Read,Edit,Write,Glob,Grep,Bash"
    --append-system-prompt "$(cat "$(style_file "$ARM")")")
  [[ "$ARM" == rtk ]] && ARGS+=(--settings "$BENCH_DIR/styles/rtk.settings.json")

  (cd "$WORKDIR/$ID" && claude "${ARGS[@]}" >"$RAW/$ID.jsonl" 2>"$RAW/$ID.err"; echo "$ID exit $?") &
  printf '{"id":"%s","task":"%s","batch":%s,"arm":"%s","seed":"%s","base_sha":"%s","model":"%s","started":"%s"}\n' \
    "$ID" "$TASK" "$BATCH" "$ARM" "$SEED" "$BASE_SHA" "$MODEL" "$(date -u +%FT%TZ)" >>"$BENCH_DIR/results/manifest.jsonl"
done
wait
echo "batch $BATCH done. Score it with: bench/score.sh $TASK $BATCH"

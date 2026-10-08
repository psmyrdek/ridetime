#!/usr/bin/env bash
# Scores every run of one batch: type check, build, prettier, e2e, payload, tokens -> results/runs.csv.
# Usage: bench/score.sh <task> <batch>
set -uo pipefail

BENCH_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$BENCH_DIR/.." && pwd)"
WORKDIR="${BENCH_WORKDIR:-$REPO/../ridetime-bench}"
RESULTS="$BENCH_DIR/results"
TASK="${1:?task}"
BATCH="${2:?batch}"
PORT="${PORT:-4321}"
# Convention: task <name> builds the page /<name>, tested by tasks/<name>.e2e.mjs.
PAGE="$TASK/index.html"
E2E="$BENCH_DIR/tasks/$TASK.e2e.mjs"

ids=$(jq -r --arg t "$TASK" --argjson b "$BATCH" 'select(.task == $t and .batch == $b) | "\(.id) \(.arm)"' \
  "$RESULTS/manifest.jsonl" | sort -u)
[[ -n "$ids" ]] || { echo "no runs for $TASK batch $BATCH in manifest.jsonl" >&2; exit 1; }

# fd 3 keeps the loop input away from npx and node, which may read stdin.
while read -r -u 3 ID ARM; do
  WT="$WORKDIR/$ID"
  BASE=$(jq -r --arg id "$ID" 'select(.id == $id) | .base_sha' "$RESULTS/manifest.jsonl" | head -n1)
  echo "== $ID"
  commits=$(git -C "$WT" rev-list --count "$BASE..HEAD")
  check=$(cd "$WT" && npx astro check 2>&1 | tail -n 5)
  grep -q -- '- 0 errors' <<<"$check" && grep -q -- '- 0 warnings' <<<"$check" && check_ok=1 || check_ok=0
  (cd "$WT" && rm -rf .vercel dist && npx astro build >"$RESULTS/raw/$ID.build.log" 2>&1) && build_ok=1 || build_ok=0
  mapfile -t touched < <(git -C "$WT" diff --name-only --diff-filter=d "$BASE..HEAD" -- '*.ts' '*.astro' '*.svelte' '*.css')
  prettier_ok=1
  ((${#touched[@]})) && { (cd "$WT" && npx prettier --check "${touched[@]}" >/dev/null 2>&1) || prettier_ok=0; }

  e2e='{"pass":0,"total":0}'
  html_gz=0
  js_gz=0
  STATIC="$WT/.vercel/output/static"
  if ((build_ok)) && [[ -f "$STATIC/$PAGE" ]]; then
    (cd "$STATIC" && exec python3 -m http.server "$PORT" >/dev/null 2>&1) &
    server=$!
    sleep 1
    e2e=$(node "$E2E" "http://localhost:$PORT" "$WT" --json || echo '{"pass":0,"total":0}')
    kill "$server"
    html_gz=$(gzip -c "$STATIC/$PAGE" | wc -c)
    for js in $(grep -o '/_astro/[^"]*\.js' "$STATIC/$PAGE" | sort -u); do
      js_gz=$((js_gz + $(gzip -c "$STATIC$js" | wc -c)))
    done
  fi
  echo "$e2e" >"$RESULTS/raw/$ID.e2e.json"

  jq -n --arg id "$ID" --arg task "$TASK" --argjson batch "$BATCH" --arg arm "$ARM" \
    --argjson commits "$commits" --argjson c "$check_ok" --argjson b "$build_ok" --argjson p "$prettier_ok" \
    --argjson e2e "$e2e" --argjson h "$html_gz" --argjson j "$js_gz" \
    '{id: $id, task: $task, batch: $batch, arm: $arm, commits: $commits, astro_check_ok: $c, build_ok: $b,
      prettier_ok: $p, e2e_pass: $e2e.pass, e2e_total: $e2e.total, html_gz_bytes: $h, js_gz_bytes: $j}' \
    >"$RESULTS/raw/$ID.meta.json"
  python3 -I "$BENCH_DIR/tools/collect.py" "$RESULTS/raw/$ID.jsonl" "$RESULTS/raw/$ID.meta.json" "$RESULTS/runs.csv"
done 3<<<"$ids"

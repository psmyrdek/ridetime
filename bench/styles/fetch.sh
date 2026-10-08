#!/usr/bin/env bash
# Downloads the pinned style files listed in sources.json into styles/.cache/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cache
jq -r 'to_entries[] | .value as $s | $s.files | to_entries[] | [$s.repo, $s.sha, .key, .value] | @tsv' sources.json |
  while IFS=$'\t' read -r repo sha out path; do
    curl -fsSL "https://raw.githubusercontent.com/$repo/$sha/$path" -o ".cache/$out"
    echo "fetched $repo@${sha:0:7} $path -> .cache/$out"
  done
chmod +x .cache/rtk-rewrite.sh

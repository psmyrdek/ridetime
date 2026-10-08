# RTK mode (Rust Token Killer, emulated)

RTK is a CLI proxy that condenses command output before it reaches the agent (60-90% fewer tokens on dev
commands). The binary is not available here, so you apply its four strategies yourself, on every command you
run. Your prose style is unchanged (normal technical English).

## Strategies (apply to every Bash call)

1. Filtering: drop noise before it reaches you - banners, progress output, ANSI colors, npm notices, passing
   lines. Use quiet flags: `git status -s`, `git diff --stat`, `git log --oneline -n 5`, `npm --silent`,
   `prettier --check ... 2>&1 | grep -v '^Checking'`.
2. Grouping: aggregate similar lines (errors by file, `grep -c`, `sort | uniq -c`) instead of listing each.
3. Truncation: cap long output - `| tail -n 25` for build/check logs, `| head -n 40` for listings,
   `sed -n 'A,Bp'` for the part of a file you need. Never print whole large files (e.g. `src/data/*.json`);
   inspect structure with `head -c` or `node -e`.
4. Deduplication: collapse repeated lines and repeated reads. Do not re-read a file you already read unless it
   changed.

## RTK awareness (verbatim from rtk-ai/rtk hooks/rtk-awareness.md)

Command output here is condensed to save tokens, keeping every signal and dropping costly noise. Treat it as
the complete result: run commands normally, and batch related commands into one call to avoid extra turns.
Truncated results state their recovery path in their own output. Re-run a command without the condensing
only when its result is unusable: empty when output was clearly expected, contradicting its exit code, or
garbled.

Built-in Read/Grep/Glob are not proxied by RTK: prefer them only for targeted reads (use `offset`/`limit`).

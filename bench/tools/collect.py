"""Turns one scored run into a row of results/runs.csv.

Usage: python3 collect.py <run.jsonl> <meta.json> <runs.csv>
<run.jsonl> is `claude -p --output-format stream-json --verbose` output. <meta.json> holds the fields
score.sh measured (id, arm, task, batch, check/build/prettier flags, e2e result, payload sizes).
Token counts come from the final `result` event, which the CLI totals itself.
"""

import csv
import json
import os
import sys

FIELDS = [
    'id', 'task', 'batch', 'arm', 'is_error', 'cost_usd', 'input_tokens', 'cache_creation_input_tokens',
    'cache_read_input_tokens', 'output_tokens', 'total_input_tokens', 'num_turns', 'tool_calls',
    'tool_result_chars', 'assistant_text_chars', 'duration_ms', 'commits', 'astro_check_ok', 'build_ok',
    'prettier_ok', 'e2e_pass', 'e2e_total', 'html_gz_bytes', 'js_gz_bytes',
]


def parse_stream(path):
    result, tool_calls, text_chars, result_chars = None, 0, 0, 0
    for line in open(path, encoding='utf-8'):
        try:
            event = json.loads(line)
        except ValueError:
            continue
        kind = event.get('type')
        content = (event.get('message') or {}).get('content')
        if kind == 'result':
            result = event
        elif kind == 'assistant' and isinstance(content, list):
            for block in content:
                if block.get('type') == 'tool_use':
                    tool_calls += 1
                elif block.get('type') == 'text':
                    text_chars += len(block.get('text', ''))
        elif kind == 'user' and isinstance(content, list):
            for block in content:
                if block.get('type') != 'tool_result':
                    continue
                body = block.get('content')
                if isinstance(body, str):
                    result_chars += len(body)
                elif isinstance(body, list):
                    result_chars += sum(len(b.get('text', '')) for b in body if isinstance(b, dict))
    if result is None:
        raise SystemExit(f'{path}: no result event - the run did not finish')
    usage = result.get('usage') or {}
    row = {k: usage.get(k, 0) or 0 for k in
           ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens')}
    row['total_input_tokens'] = row['input_tokens'] + row['cache_creation_input_tokens'] + row['cache_read_input_tokens']
    row.update(
        is_error=int(bool(result.get('is_error'))),
        cost_usd=result.get('total_cost_usd'),
        num_turns=result.get('num_turns'),
        duration_ms=result.get('duration_ms'),
        tool_calls=tool_calls,
        tool_result_chars=result_chars,
        assistant_text_chars=text_chars,
    )
    return row


def main():
    stream, meta_path, out = sys.argv[1:4]
    row = parse_stream(stream)
    row.update(json.load(open(meta_path, encoding='utf-8')))
    new = not os.path.exists(out)
    with open(out, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, FIELDS, extrasaction='ignore')
        if new:
            writer.writeheader()
        writer.writerow(row)
    print(f"{row['id']}: cost ${row['cost_usd']}, {row['total_input_tokens']} in / {row['output_tokens']} out, "
          f"e2e {row['e2e_pass']}/{row['e2e_total']}")


if __name__ == '__main__':
    main()

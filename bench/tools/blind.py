"""Exports one batch's diffs under random labels for blind review.

Usage: python3 blind.py <task> <batch> [workdir]
Writes results/blind/<task>-b<batch>/<label>.diff for reviewers and results/blind-keys/<task>-b<batch>.json
with the label -> arm mapping. Never show the keys folder to a reviewer.
"""

import json
import os
import random
import re
import subprocess
import sys

BENCH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(BENCH, 'results')
# Words that would reveal the arm: style names and their typical vocabulary.
LEAKS = re.compile(r'caveman|\brtk\b|ste100|simplified technical english|simple-english', re.I)


def main():
    task, batch = sys.argv[1], int(sys.argv[2])
    workdir = sys.argv[3] if len(sys.argv) > 3 else os.environ.get(
        'BENCH_WORKDIR', os.path.join(os.path.dirname(BENCH), '..', 'ridetime-bench'))
    runs = [json.loads(line) for line in open(os.path.join(RESULTS, 'manifest.jsonl'), encoding='utf-8')]
    runs = {r['arm']: r for r in runs if r['task'] == task and r['batch'] == batch}
    labels = [chr(ord('A') + i) for i in range(len(runs))]
    random.SystemRandom().shuffle(labels)

    out = os.path.join(RESULTS, 'blind', f'{task}-b{batch}')
    keys = os.path.join(RESULTS, 'blind-keys')
    os.makedirs(out, exist_ok=True)
    os.makedirs(keys, exist_ok=True)
    mapping = {}
    for label, (arm, run) in zip(labels, sorted(runs.items())):
        wt = os.path.join(workdir, run['id'])
        diff = subprocess.run(['git', '-C', wt, 'diff', f"{run['base_sha']}..HEAD"], capture_output=True, text=True,
                              check=True).stdout
        leaks = LEAKS.findall(diff)
        if leaks:
            print(f'warning: {label} diff mentions {sorted(set(leaks))}, scrub it by hand before review')
        with open(os.path.join(out, f'{label}.diff'), 'w', encoding='utf-8') as f:
            f.write(diff)
        mapping[label] = arm
    with open(os.path.join(keys, f'{task}-b{batch}.json'), 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2, sort_keys=True)
    print(f'{len(mapping)} diffs in {out}')


if __name__ == '__main__':
    main()

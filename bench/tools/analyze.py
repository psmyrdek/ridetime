"""Statistics for results/runs.csv (+ optional results/reviews.csv) -> results/report.md.

Usage: python3 analyze.py [--control control] [--metric cost_usd]
Per arm and task: median, IQR and a bootstrap 95% CI of the median. Between arms: Kruskal-Wallis, then
Mann-Whitney U of every arm vs the control arm with Holm correction and Cliff's delta. Full e2e pass rate
vs control: Fisher's exact test. Pure standard library, so it runs without scipy.
"""

import argparse
import csv
import json
import math
import os
import random
import statistics
from collections import defaultdict

BENCH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS = os.path.join(BENCH, 'results')
METRICS = ['cost_usd', 'total_input_tokens', 'output_tokens', 'num_turns', 'tool_result_chars', 'duration_ms',
           'review_score']


def quantile(xs, q):
    xs = sorted(xs)
    pos = (len(xs) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def bootstrap_median_ci(xs, n=10_000, seed=0):
    rng = random.Random(seed)
    meds = sorted(statistics.median(rng.choices(xs, k=len(xs))) for _ in range(n))
    return meds[int(0.025 * n)], meds[int(0.975 * n) - 1]


def ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    r = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def tie_term(values):
    counts = defaultdict(int)
    for v in values:
        counts[v] += 1
    return sum(t ** 3 - t for t in counts.values())


def mann_whitney(a, b):
    """Two-sided p-value, normal approximation with tie and continuity correction."""
    n1, n2 = len(a), len(b)
    r = ranks(a + b)
    u = sum(r[:n1]) - n1 * (n1 + 1) / 2
    n = n1 + n2
    var = n1 * n2 / 12 * ((n + 1) - tie_term(a + b) / (n * (n - 1)))
    if var == 0:
        return 1.0
    z = (abs(u - n1 * n2 / 2) - 0.5) / math.sqrt(var)
    return min(1.0, math.erfc(max(z, 0) / math.sqrt(2)))


def chi2_sf(x, df):
    """Survival function of chi-square via the regularized upper incomplete gamma."""
    s, x = df / 2, x / 2
    if x <= 0:
        return 1.0
    if x < s + 1:  # series for the lower part
        term = total = 1 / s
        k = s
        while abs(term) > 1e-12 * abs(total):
            k += 1
            term *= x / k
            total += term
        return max(0.0, 1 - total * math.exp(-x + s * math.log(x) - math.lgamma(s)))
    # Continued fraction for the upper part (Lentz).
    b, c, d = x + 1 - s, 1e300, 1 / (x + 1 - s)
    h = d
    for i in range(1, 500):
        an = -i * (i - s)
        b += 2
        d = an * d + b
        d = 1e-300 if abs(d) < 1e-300 else d
        c = b + an / c
        c = 1e-300 if abs(c) < 1e-300 else c
        d = 1 / d
        h *= d * c
        if abs(d * c - 1) < 1e-12:
            break
    return math.exp(-x + s * math.log(x) - math.lgamma(s)) * h


def kruskal(groups):
    groups = [g for g in groups if g]
    allv = [v for g in groups for v in g]
    n = len(allv)
    if len(groups) < 2 or n < 3:
        return float('nan')
    r = ranks(allv)
    h, i = 0.0, 0
    for g in groups:
        h += sum(r[i:i + len(g)]) ** 2 / len(g)
        i += len(g)
    h = 12 / (n * (n + 1)) * h - 3 * (n + 1)
    h /= 1 - tie_term(allv) / (n ** 3 - n) or 1
    return chi2_sf(h, len(groups) - 1)


def cliffs_delta(a, b):
    gt = sum(1 for x in a for y in b if x > y)
    lt = sum(1 for x in a for y in b if x < y)
    return (gt - lt) / (len(a) * len(b))


def holm(pvals):
    order = sorted(range(len(pvals)), key=lambda i: pvals[i])
    adj, running = [0.0] * len(pvals), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(pvals) - rank) * pvals[i]))
        adj[i] = running
    return adj


def fisher_exact(a, b, c, d):
    """Two-sided Fisher's exact test for [[a, b], [c, d]]."""
    n, r1, c1 = a + b + c + d, a + b, a + c

    def p(x):
        return math.comb(c1, x) * math.comb(n - c1, r1 - x) / math.comb(n, r1)

    observed = p(a)
    lo, hi = max(0, r1 + c1 - n), min(r1, c1)
    return min(1.0, sum(p(x) for x in range(lo, hi + 1) if p(x) <= observed * (1 + 1e-9)))


def load():
    runs = list(csv.DictReader(open(os.path.join(RESULTS, 'runs.csv'), encoding='utf-8')))
    reviews_path = os.path.join(RESULTS, 'reviews.csv')
    if os.path.exists(reviews_path):
        scores = defaultdict(list)
        for row in csv.DictReader(open(reviews_path, encoding='utf-8')):
            keys = json.load(open(os.path.join(RESULTS, 'blind-keys', f"{row['task']}-b{row['batch']}.json")))
            scores[(row['task'], row['batch'], keys[row['label']])].append(float(row['score']))
        for run in runs:
            s = scores.get((run['task'], run['batch'], run['arm']))
            run['review_score'] = statistics.mean(s) if s else ''
    return runs


def fmt(x):
    if float(x).is_integer() or abs(x) >= 100:
        return f'{x:,.0f}'
    return f'{x:.3f}'


def main():
    global RESULTS
    ap = argparse.ArgumentParser()
    ap.add_argument('--control', default='control')
    ap.add_argument('--metric', default='cost_usd', help='primary metric, fixed before the experiment')
    ap.add_argument('--results', default=RESULTS, help='results directory (default: bench/results)')
    args = ap.parse_args()
    RESULTS = args.results
    runs = load()
    lines = ['# Benchmark report', '', f'Primary metric: `{args.metric}`. Control arm: `{args.control}`.', '']

    for task in sorted({r['task'] for r in runs}):
        task_runs = [r for r in runs if r['task'] == task]
        arms = sorted({r['arm'] for r in task_runs}, key=lambda a: (a != args.control, a))
        lines += [f'## Task `{task}`', '', '| arm | n | full e2e pass | ' + ' | '.join(METRICS) + ' |',
                  '|---|---|---|' + '---|' * len(METRICS)]
        for arm in arms:
            rs = [r for r in task_runs if r['arm'] == arm]
            full = sum(1 for r in rs if r['e2e_total'] not in ('', '0') and r['e2e_pass'] == r['e2e_total'])
            cells = []
            for m in METRICS:
                xs = [float(r[m]) for r in rs if r.get(m) not in (None, '')]
                if not xs:
                    cells.append('-')
                    continue
                lo, hi = bootstrap_median_ci(xs)
                cells.append(f'{fmt(statistics.median(xs))} [{fmt(lo)}-{fmt(hi)}] IQR {fmt(quantile(xs, .75) - quantile(xs, .25))}')
            lines.append(f'| {arm} | {len(rs)} | {full}/{len(rs)} | ' + ' | '.join(cells) + ' |')

        lines += ['', 'Medians with bootstrap 95% CI in brackets.', '',
                  '| metric | Kruskal-Wallis p | ' + ' | '.join(f'{a} vs {args.control}: p(Holm), delta' for a in arms[1:]) + ' |',
                  '|---|---|' + '---|' * (len(arms) - 1)]
        control = [r for r in task_runs if r['arm'] == args.control]
        for m in METRICS:
            data = {a: [float(r[m]) for r in task_runs if r['arm'] == a and r.get(m) not in (None, '')] for a in arms}
            if not data.get(args.control) or len(arms) < 2:
                continue
            raw = [mann_whitney(data[a], data[args.control]) if data[a] else 1.0 for a in arms[1:]]
            adj = holm(raw)
            cells = [f'{p:.3f}, {cliffs_delta(data[a], data[args.control]):+.2f}' if data[a] else '-'
                     for a, p in zip(arms[1:], adj)]
            lines.append(f'| {m} | {kruskal(list(data.values())):.3f} | ' + ' | '.join(cells) + ' |')

        def passed(rs):
            return sum(1 for r in rs if r['e2e_total'] not in ('', '0') and r['e2e_pass'] == r['e2e_total'])

        lines += ['', 'Delta is Cliff\'s delta vs control: negative means the arm is lower (cheaper, fewer tokens).', '',
                  'Full e2e pass vs control (Fisher exact): ' + ', '.join(
                      f'{a} p={fisher_exact(passed(rs), len(rs) - passed(rs), passed(control), len(control) - passed(control)):.3f}'
                      for a in arms[1:] for rs in [[r for r in task_runs if r['arm'] == a]]), '']

    out = os.path.join(RESULTS, 'report.md')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'wrote {out}')


if __name__ == '__main__':
    main()

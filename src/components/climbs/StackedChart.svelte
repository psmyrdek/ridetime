<script module lang="ts">
  export type Align = 'start' | 'summit';
  export type ElevationMode = 'absolute' | 'relative';
</script>

<script lang="ts">
  import { gradeAt, gradeColor, pointAt } from '../../utils/climbs/geo';
  import { formatGrade, formatKm, formatM, formatNumber, niceDomain, niceTicks } from '../../utils/climbs/format';
  import type { Climb } from '../../utils/climbs/climb.svelte';

  interface Props {
    climbs: Climb[];
    align: Align;
    elevation: ElevationMode;
    height?: number;
  }

  let { climbs, align, elevation, height = 380 }: Props = $props();

  const M = { top: 16, right: 16, bottom: 30, left: 50 };
  let width = $state(800);

  const series = $derived(
    climbs
      .filter((c) => c.profile)
      .map((climb) => {
        const { points, stats } = climb.profile!;
        // Aligned to the summit, distances become "km before the finish" (≤ 0).
        const offset = align === 'summit' ? -stats.length : 0;
        const base = elevation === 'relative' ? stats.startEle : 0;
        return { climb, points, stats, offset, base };
      })
  );

  const maxLength = $derived(Math.max(1, ...series.map((s) => s.stats.length)));
  const xDomain = $derived<[number, number]>(align === 'summit' ? [-maxLength, 0] : [0, maxLength]);
  const yDomain = $derived.by<[number, number]>(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.ele - s.base));
    if (values.length === 0) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return niceDomain(elevation === 'relative' ? Math.min(0, min) : min, max, 6);
  });

  const innerW = $derived(Math.max(1, width - M.left - M.right));
  const innerH = $derived(height - M.top - M.bottom);
  const baseline = $derived(M.top + innerH);
  const x = (v: number) => M.left + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerW;
  const y = (v: number) => M.top + (1 - (v - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH;

  const paths = $derived(
    series.map((s) => {
      const top = s.points.map((p) => `${x(p.d + s.offset)},${y(p.ele - s.base)}`);
      const first = x(s.offset);
      const last = x(s.stats.length + s.offset);
      return {
        ...s,
        line: `M${top.join(' L')}`,
        area: `M${first},${baseline} L${top.join(' L')} L${last},${baseline} Z`,
      };
    })
  );

  const xTicks = $derived(niceTicks(xDomain[0] / 1000, xDomain[1] / 1000, Math.max(2, Math.floor(innerW / 90))));
  const yTicks = $derived(niceTicks(yDomain[0], yDomain[1], 5));

  let hoverX = $state<number | undefined>();

  const readouts = $derived(
    hoverX === undefined
      ? []
      : series.flatMap((s) => {
          const d = hoverX! - s.offset;
          if (d < 0 || d > s.stats.length) return [];
          const p = pointAt(s.points, d);
          return [{ climb: s.climb, d, value: p.ele - s.base, grade: gradeAt(s.points, d) }];
        })
  );

  function onpointermove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const v = xDomain[0] + ((e.clientX - rect.left - M.left) / innerW) * (xDomain[1] - xDomain[0]);
    hoverX = v >= xDomain[0] && v <= xDomain[1] ? v : undefined;
    for (const s of series) {
      const d = v - s.offset;
      s.climb.hover = hoverX !== undefined && d >= 0 && d <= s.stats.length ? d : undefined;
    }
  }

  function onpointerleave() {
    hoverX = undefined;
    for (const s of series) s.climb.hover = undefined;
  }

  const tickLabel = (t: number) => formatNumber(Math.abs(t), t % 1 ? 1 : 0);
</script>

<div class="relative" bind:clientWidth={width}>
  <svg
    {width}
    {height}
    class="block touch-none select-none"
    role="img"
    aria-label="Nałożone profile: {climbs.map((c) => c.label).join(' i ')}"
    {onpointermove}
    {onpointerleave}>
    {#each yTicks as t (t)}
      <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} class="stroke-white/8" />
      <text x={M.left - 8} y={y(t)} dy="0.32em" text-anchor="end" class="fill-slate-500 text-[11px] tabular-nums">
        {elevation === 'relative' && t > 0 ? '+' : ''}{formatNumber(t)}
      </text>
    {/each}
    {#each xTicks as t (t)}
      <line x1={x(t * 1000)} x2={x(t * 1000)} y1={M.top} y2={baseline} class="stroke-white/5" />
      <text x={x(t * 1000)} y={height - 10} text-anchor="middle" class="fill-slate-500 text-[11px] tabular-nums">
        {tickLabel(t)}{t === xTicks.at(-1) && align === 'start' ? ' km' : ''}{t === 0 && align === 'summit'
          ? ' km'
          : ''}
      </text>
    {/each}
    <text x={M.left} y={M.top - 4} class="fill-slate-500 text-[10px]">
      {elevation === 'relative' ? 'm od startu' : 'm n.p.m.'}
    </text>

    {#each paths as p (p.climb.id)}
      <path d={p.area} fill={p.climb.color} fill-opacity="0.22" />
    {/each}
    {#each paths as p (p.climb.id)}
      <path d={p.line} fill="none" stroke={p.climb.color} stroke-width="2.5" stroke-linejoin="round" />
    {/each}

    {#if hoverX !== undefined}
      <line x1={x(hoverX)} x2={x(hoverX)} y1={M.top} y2={baseline} class="stroke-white/60" stroke-dasharray="3 3" />
      {#each readouts as r (r.climb.id)}
        <circle cx={x(hoverX)} cy={y(r.value)} r="5" fill={r.climb.color} class="stroke-white" stroke-width="2" />
      {/each}
    {/if}
  </svg>

  {#if hoverX !== undefined && readouts.length > 0}
    <div
      class="pointer-events-none absolute top-2 space-y-1 rounded-lg bg-ridetime-dark/90 px-3 py-2 text-xs whitespace-nowrap text-slate-200 tabular-nums shadow-lg ring-1 ring-white/10"
      style:left="{x(hoverX) > width / 2 ? x(hoverX) - 12 : x(hoverX) + 12}px"
      style:transform={x(hoverX) > width / 2 ? 'translateX(-100%)' : undefined}>
      <p class="text-slate-400">
        {align === 'summit' ? `${formatKm(-hoverX)} do szczytu` : `${formatKm(hoverX)} od startu`}
      </p>
      {#each readouts as r (r.climb.id)}
        <p class="flex items-center gap-2">
          <span class="size-2 rounded-full" style:background={r.climb.color}></span>
          <span class="max-w-40 truncate">{r.climb.label}</span>
          <span class="ml-auto pl-2 font-semibold text-white">
            {elevation === 'relative' ? '+' : ''}{formatM(r.value)}
          </span>
          <span class="w-12 text-right font-semibold" style:color={gradeColor(r.grade)}>{formatGrade(r.grade)}</span>
        </p>
      {/each}
    </div>
  {/if}
</div>

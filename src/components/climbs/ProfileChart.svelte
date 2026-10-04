<script lang="ts">
  import { gradeAt, gradeColor, pointAt, segments, type ProfilePoint } from '../../utils/climbs/geo';
  import { formatGrade, formatKm, formatM, formatNumber, niceTicks } from '../../utils/climbs/format';
  import type { Climb } from '../../utils/climbs/climb.svelte';

  interface Props {
    climb: Climb;
    /** Shared x/y domains let two charts be compared at the same scale. */
    xMax: number;
    yDomain: [number, number];
    segmentStep: number;
    height?: number;
  }

  let { climb, xMax, yDomain, segmentStep, height = 240 }: Props = $props();

  const M = { top: 12, right: 12, bottom: 28, left: 46 };
  let width = $state(600);

  const points = $derived(climb.profile?.points ?? []);
  const innerW = $derived(Math.max(1, width - M.left - M.right));
  const innerH = $derived(height - M.top - M.bottom);
  const x = (d: number) => M.left + (d / xMax) * innerW;
  const y = (ele: number) => M.top + (1 - (ele - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerH;
  const baseline = $derived(M.top + innerH);

  const bars = $derived(
    segments(points, segmentStep).map((s) => {
      const inside = points.filter((p) => p.d > s.from && p.d < s.to);
      const edge = [pointAt(points, s.from), ...inside, pointAt(points, s.to)];
      const top = edge.map((p) => `${x(p.d)},${y(p.ele)}`).join(' L');
      return {
        ...s,
        path: `M${x(s.from)},${baseline} L${top} L${x(s.to)},${baseline} Z`,
        width: x(s.to) - x(s.from),
      };
    })
  );

  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(p.d)},${y(p.ele)}`).join(''));
  const xTicks = $derived(niceTicks(0, xMax / 1000, Math.max(2, Math.floor(innerW / 80))));
  const yTicks = $derived(niceTicks(yDomain[0], yDomain[1], 4));

  const hovered = $derived.by((): (ProfilePoint & { grade: number }) | undefined => {
    if (climb.hover === undefined || points.length === 0) return undefined;
    const p = pointAt(points, climb.hover);
    return { ...p, grade: gradeAt(points, p.d) };
  });

  function onpointermove(e: PointerEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const d = ((e.clientX - rect.left - M.left) / innerW) * xMax;
    const length = points.at(-1)?.d ?? 0;
    climb.hover = d >= 0 && d <= length ? d : undefined;
  }
</script>

<div class="relative" bind:clientWidth={width}>
  <svg
    {width}
    {height}
    class="block touch-none select-none"
    role="img"
    aria-label="Profil wysokości: {climb.label}"
    {onpointermove}
    onpointerleave={() => (climb.hover = undefined)}>
    {#each yTicks as t (t)}
      <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} class="stroke-white/8" />
      <text x={M.left - 8} y={y(t)} dy="0.32em" text-anchor="end" class="fill-slate-500 text-[10px] tabular-nums">
        {formatNumber(t)}
      </text>
    {/each}
    {#each xTicks as t (t)}
      <text x={x(t * 1000)} y={height - 8} text-anchor="middle" class="fill-slate-500 text-[10px] tabular-nums">
        {formatNumber(t, t % 1 ? 1 : 0)}{t === xTicks.at(-1) ? ' km' : ''}
      </text>
    {/each}

    {#each bars as bar (bar.from)}
      <path
        d={bar.path}
        fill={gradeColor(bar.grade)}
        fill-opacity="0.85"
        class="stroke-ridetime-dark/60"
        stroke-width="1" />
      {@const label = formatNumber(bar.grade, 1)}
      {#if bar.width >= label.length * 7 + 4}
        <text
          x={x(bar.from) + bar.width / 2}
          y={baseline - 7}
          text-anchor="middle"
          class="fill-ridetime-dark text-[10px] font-bold tabular-nums">
          {label}
        </text>
      {/if}
    {/each}
    <path d={line} fill="none" class="stroke-white" stroke-width="1.5" stroke-linejoin="round" />

    {#if hovered}
      <line
        x1={x(hovered.d)}
        x2={x(hovered.d)}
        y1={M.top}
        y2={baseline}
        class="stroke-white/60"
        stroke-dasharray="3 3" />
      <circle cx={x(hovered.d)} cy={y(hovered.ele)} r="4.5" fill={climb.color} class="stroke-white" stroke-width="2" />
    {/if}
  </svg>

  {#if hovered}
    <div
      class="pointer-events-none absolute top-1 rounded-lg bg-ridetime-dark/90 px-2.5 py-1.5 text-xs whitespace-nowrap text-slate-200 tabular-nums shadow-lg ring-1 ring-white/10"
      style:left="{Math.min(Math.max(x(hovered.d), M.left + 60), width - 70)}px"
      style:transform="translateX(-50%)">
      <span class="text-slate-400">{formatKm(hovered.d)}</span>
      · <span class="font-semibold text-white">{formatM(hovered.ele)}</span>
      · <span style:color={gradeColor(hovered.grade)} class="font-semibold">{formatGrade(hovered.grade)}</span>
    </div>
  {/if}
</div>

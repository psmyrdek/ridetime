<script lang="ts">
  import { onMount } from 'svelte';
  import ClimbPanel from './ClimbPanel.svelte';
  import CompareSummary from './CompareSummary.svelte';
  import ProfileChart from './ProfileChart.svelte';
  import StackedChart, { type Align, type ElevationMode } from './StackedChart.svelte';
  import { Climb, PRESETS } from '../../utils/climbs/climb.svelte';
  import { GRADE_SCALE, segmentLength } from '../../utils/climbs/geo';
  import { niceDomain } from '../../utils/climbs/format';

  type View = 'split' | 'stacked';

  const a = new Climb('a', '#9acdfa');
  const b = new Climb('b', '#fc7c3c');
  const climbs = [a, b];

  let view = $state<View>('split');
  let align = $state<Align>('start');
  let elevation = $state<ElevationMode>('absolute');
  let sharedScale = $state(true);
  let copied = $state(false);
  let restored = $state(false);

  onMount(() => {
    const params = new URLSearchParams(location.search);
    view = params.get('view') === 'stacked' ? 'stacked' : 'split';
    align = params.get('align') === 'summit' ? 'summit' : 'start';
    elevation = params.get('ele') === 'relative' ? 'relative' : 'absolute';
    const restoredA = a.restore(params.get('a') ?? '');
    const restoredB = b.restore(params.get('b') ?? '');
    if (!restoredA && !restoredB) {
      a.applyPreset(PRESETS[0]);
      b.applyPreset(PRESETS[2]);
    }
    restored = true;
  });

  // Keeps the URL shareable: both climbs and the view settings.
  $effect(() => {
    if (!restored) return;
    const params = new URLSearchParams();
    for (const climb of climbs) {
      const value = climb.serialize();
      if (value) params.set(climb.id, value);
    }
    if (view === 'stacked') params.set('view', view);
    if (align === 'summit') params.set('align', align);
    if (elevation === 'relative') params.set('ele', elevation);
    const query = params.toString().replaceAll('%2C', ',').replaceAll('%7E', '~');
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  });

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the URL in the address bar is still shareable.
    }
  }

  const ready = $derived(climbs.filter((c) => c.profile));

  // In the side-by-side view both charts share axes and bar length, so the steeper climb also looks steeper.
  const scale = $derived.by(() => {
    const own = (c: Climb) => {
      const s = c.profile!.stats;
      const min = Math.min(...c.profile!.points.map((p) => p.ele));
      return { xMax: s.length, yDomain: niceDomain(min, s.topEle, 4), step: segmentLength(s.length) };
    };
    if (!sharedScale || ready.length < 2) return Object.fromEntries(ready.map((c) => [c.id, own(c)]));
    const all = ready.flatMap((c) => c.profile!.points.map((p) => p.ele));
    const xMax = Math.max(...ready.map((c) => c.profile!.stats.length));
    const shared = { xMax, yDomain: niceDomain(Math.min(...all), Math.max(...all), 4), step: segmentLength(xMax) };
    return { a: shared, b: shared };
  });
</script>

{#snippet toggle(label: string, options: [string, string][], value: string, set: (v: string) => void)}
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-400">{label}</span>
    <div
      class="flex rounded-full bg-white/5 p-1 text-xs font-semibold ring-1 ring-white/10"
      role="group"
      aria-label={label}>
      {#each options as [key, text] (key)}
        <button
          type="button"
          aria-pressed={value === key}
          class="rounded-full px-3 py-1.5 whitespace-nowrap transition {value === key
            ? 'bg-ridetime-light text-ridetime-dark'
            : 'text-slate-300 hover:text-white'}"
          onclick={() => set(key)}>
          {text}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

<div class="space-y-6">
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        {@render toggle(
          'Widok',
          [
            ['split', 'Obok siebie'],
            ['stacked', 'Nałożone'],
          ],
          view,
          (v) => (view = v as View)
        )}
        {#if view === 'stacked'}
          {@render toggle(
            'Wyrównaj',
            [
              ['start', 'Do startu'],
              ['summit', 'Do szczytu'],
            ],
            align,
            (v) => (align = v as Align)
          )}
          {@render toggle(
            'Wysokość',
            [
              ['absolute', 'n.p.m.'],
              ['relative', 'Od startu'],
            ],
            elevation,
            (v) => (elevation = v as ElevationMode)
          )}
        {:else}
          <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" bind:checked={sharedScale} class="size-4 accent-ridetime-light" />
            Wspólna skala wykresów
          </label>
        {/if}
      </div>
      <button
        type="button"
        class="rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10"
        onclick={share}>
        {copied ? 'Skopiowano ✓' : 'Kopiuj link do porównania'}
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      {#each climbs as climb (climb.id)}
        <ClimbPanel {climb}>
          {#snippet chart()}
            {#if view === 'split' && scale[climb.id]}
              {@const s = scale[climb.id]}
              <ProfileChart {climb} xMax={s.xMax} yDomain={s.yDomain} segmentStep={s.step} />
            {/if}
          {/snippet}
        </ClimbPanel>
      {/each}
    </div>
  </div>

  {#if view === 'stacked'}
    <section class="rounded-3xl bg-ridetime-surface p-4 ring-1 ring-white/10 sm:p-6" aria-label="Nałożone profile">
      <div class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {#each climbs as climb (climb.id)}
          <span class="flex items-center gap-2 {climb.profile ? 'text-slate-200' : 'text-slate-500'}">
            <span class="h-1 w-5 rounded-full" style:background={climb.color}></span>
            {climb.label}
          </span>
        {/each}
      </div>
      {#if ready.length > 0}
        <StackedChart {climbs} {align} {elevation} />
      {:else}
        <p class="py-20 text-center text-sm text-slate-500">Wybierz podjazdy powyżej, aby nałożyć profile.</p>
      {/if}
    </section>
  {:else}
    <ul class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400" aria-label="Legenda nachylenia">
      {#each GRADE_SCALE as g (g.label)}
        <li class="flex items-center gap-1.5">
          <span class="size-3 rounded-sm" style:background={g.color}></span>
          {g.label}
        </li>
      {/each}
    </ul>
  {/if}

  {#if a.profile && b.profile}
    <CompareSummary {a} {b} />
  {/if}
</div>

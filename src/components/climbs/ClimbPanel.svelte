<script lang="ts">
  import type { Snippet } from 'svelte';
  import ClimbMap from './ClimbMap.svelte';
  import PlaceSearch from './PlaceSearch.svelte';
  import { PRESETS, type Climb } from '../../utils/climbs/climb.svelte';
  import { formatGrade, formatIndex, formatKm, formatM } from '../../utils/climbs/format';
  import type { Place } from '../../utils/climbs/api';

  interface Props {
    climb: Climb;
    /** Profile chart, rendered only in the side-by-side view. */
    chart?: Snippet;
  }

  let { climb, chart }: Props = $props();

  let map: ReturnType<typeof ClimbMap> | undefined = $state();
  const nameId = $props.id();

  const near = $derived(climb.end ?? climb.start ?? { lat: 49.73, lng: 19.05 });

  function onselect(place: Place) {
    map?.flyTo(place.lat, place.lng, place.isSummit ? 14 : 13);
    // A pass or a peak is almost always where a climb ends – set it as the finish right away.
    if (place.isSummit) climb.setFinish({ lat: place.lat, lng: place.lng }, place.name);
  }

  const stats = $derived(climb.profile?.stats);
</script>

<section
  class="flex min-w-0 flex-col overflow-hidden rounded-3xl bg-ridetime-surface ring-1 ring-white/10"
  aria-labelledby={nameId}>
  <div class="space-y-4 p-4 sm:p-5">
    <div class="flex items-center gap-3">
      <span class="size-3 shrink-0 rounded-full" style:background={climb.color} aria-hidden="true"></span>
      <label for={nameId} class="sr-only">Nazwa podjazdu</label>
      <input
        id={nameId}
        value={climb.name}
        oninput={(e) => climb.setName(e.currentTarget.value)}
        placeholder={climb.label}
        class="min-w-0 flex-1 truncate border-b border-transparent bg-transparent font-main text-2xl text-white placeholder:text-slate-500 hover:border-white/10 focus:border-ridetime-light focus:outline-none" />
      {#if climb.start || climb.end}
        <button
          type="button"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          onclick={() => climb.clear()}>
          Wyczyść
        </button>
      {/if}
    </div>

    <PlaceSearch {near} {onselect} />

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-slate-500">Klasyki:</span>
      {#each PRESETS as preset (preset.name)}
        <button
          type="button"
          title="{preset.name} {preset.side ?? ''}"
          class="rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          onclick={() => climb.applyPreset(preset)}>
          {preset.name}
        </button>
      {/each}
    </div>
  </div>

  <div class="relative isolate h-72 border-y border-white/10 sm:h-80">
    <ClimbMap {climb} bind:this={map} />

    <div
      class="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2"
      role="toolbar"
      aria-label="Punkty podjazdu">
      <div
        class="pointer-events-auto flex rounded-full bg-ridetime-dark/90 p-1 text-xs font-semibold shadow-lg ring-1 ring-white/10">
        {#each [['start', 'Start'], ['end', 'Meta']] as const as [target, label] (target)}
          <button
            type="button"
            aria-pressed={climb.clickTarget === target}
            class="rounded-full px-3 py-1.5 transition {climb.clickTarget === target
              ? 'bg-ridetime-light text-ridetime-dark'
              : 'text-slate-300 hover:text-white'}"
            onclick={() => (climb.clickTarget = target)}>
            {label}
          </button>
        {/each}
      </div>
    </div>

    {#if !climb.start || !climb.end}
      <p
        class="pointer-events-none absolute inset-x-3 bottom-3 z-[500] mx-auto w-fit rounded-full bg-ridetime-dark/90 px-4 py-2 text-center text-xs text-slate-300 shadow-lg ring-1 ring-white/10">
        Kliknij na mapie, aby ustawić <strong class="text-white"
          >{climb.clickTarget === 'start' ? 'start' : 'metę'}</strong>
      </p>
    {/if}
    {#if climb.loading}
      <div class="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-ridetime-dark/30">
        <span
          class="size-8 animate-spin rounded-full border-3 border-white/20 border-t-ridetime-light"
          aria-label="Wyznaczam trasę"></span>
      </div>
    {/if}
  </div>

  <div class="flex flex-1 flex-col gap-4 p-4 sm:p-5">
    {#if climb.error}
      <p class="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
        Nie udało się wyznaczyć trasy. Przesuń punkty bliżej drogi.
        <span class="mt-1 block text-xs text-red-300/70">{climb.error}</span>
      </p>
    {/if}

    {#if stats}
      <dl class="grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10 text-center sm:grid-cols-6">
        {#each [{ label: 'Dystans', value: formatKm(stats.length) }, { label: 'Przewyższenie', value: formatM(stats.gain) }, { label: 'Śr. nachylenie', value: formatGrade(stats.avgGrade) }, { label: 'Maks. (100 m)', value: formatGrade(stats.maxGrade) }, { label: 'Szczyt', value: formatM(stats.topEle) }, { label: 'Indeks FIETS', value: formatIndex(stats.fiets) }] as stat (stat.label)}
          <div class="bg-ridetime-surface px-2 py-3">
            <dt class="text-[11px] text-slate-400">{stat.label}</dt>
            <dd class="mt-1 font-semibold whitespace-nowrap text-white tabular-nums">{stat.value}</dd>
          </div>
        {/each}
      </dl>
      {#if stats.avgGrade < 0}
        <p class="text-xs text-amber-300">
          Meta jest niżej niż start – to zjazd. Zamień punkty, żeby zobaczyć podjazd.
        </p>
      {/if}
      {@render chart?.()}
    {:else if !climb.error && !climb.loading}
      <p class="py-6 text-center text-sm text-slate-500">
        Wyszukaj przełęcz lub wybierz popularny podjazd, potem zaznacz start na mapie.
      </p>
    {/if}

    {#if climb.start && climb.end}
      <div class="mt-auto flex justify-end">
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          onclick={() => climb.reverse()}>
          ⇅ Zamień start i metę
        </button>
      </div>
    {/if}
  </div>
</section>

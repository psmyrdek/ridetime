<script lang="ts">
  import { searchPlaces, type Place } from '../../utils/climbs/api';
  import type { LatLng } from '../../utils/climbs/geo';

  interface Props {
    near: LatLng;
    onselect: (place: Place) => void;
  }

  let { near, onselect }: Props = $props();

  const inputId = $props.id();
  let query = $state('');
  let results = $state<Place[]>([]);
  let open = $state(false);
  let active = $state(0);
  let loading = $state(false);
  let error = $state<string | undefined>();

  $effect(() => {
    const q = query.trim();
    if (q.length < 2) {
      results = [];
      loading = false;
      return;
    }
    const controller = new AbortController();
    loading = true;
    error = undefined;
    const timer = setTimeout(async () => {
      try {
        results = await searchPlaces(q, $state.snapshot(near), controller.signal);
        active = 0;
        open = true;
      } catch (e) {
        if (controller.signal.aborted) return;
        error = 'Wyszukiwarka nie odpowiada';
        results = [];
      } finally {
        if (!controller.signal.aborted) loading = false;
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  function select(place: Place) {
    onselect(place);
    query = '';
    results = [];
    open = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') active = (active + 1) % results.length;
    else if (e.key === 'ArrowUp') active = (active - 1 + results.length) % results.length;
    else if (e.key === 'Enter') select(results[active]);
    else if (e.key === 'Escape') open = false;
    else return;
    e.preventDefault();
  }
</script>

<div class="relative">
  <label for={inputId} class="sr-only">Szukaj przełęczy, szczytu lub miejscowości</label>
  <svg
    class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true">
    <path
      fill-rule="evenodd"
      d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
      clip-rule="evenodd" />
  </svg>
  <input
    id={inputId}
    type="search"
    autocomplete="off"
    placeholder="Szukaj przełęczy, szczytu, miejscowości…"
    class="w-full rounded-xl bg-white/5 py-2.5 pr-10 pl-10 text-sm text-white ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-ridetime-light focus:outline-none"
    role="combobox"
    aria-expanded={open && results.length > 0}
    aria-controls="{inputId}-list"
    aria-activedescendant={open && results.length > 0 ? `${inputId}-${active}` : undefined}
    bind:value={query}
    onfocus={() => (open = results.length > 0)}
    onblur={() => setTimeout(() => (open = false), 150)}
    {onkeydown} />
  {#if loading}
    <span
      class="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-ridetime-light"
      aria-hidden="true"></span>
  {/if}

  {#if open && results.length > 0}
    <ul
      id="{inputId}-list"
      role="listbox"
      class="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-auto rounded-xl bg-ridetime-surface p-1 shadow-2xl ring-1 ring-white/10">
      {#each results as place, i (place.id)}
        <li
          id="{inputId}-{i}"
          role="option"
          aria-selected={i === active}
          class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm {i === active
            ? 'bg-white/10'
            : ''}"
          onmousedown={(e) => {
            e.preventDefault();
            select(place);
          }}
          onmouseenter={() => (active = i)}>
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full text-xs {place.isSummit
              ? 'bg-ridetime-light/15 text-ridetime-light'
              : 'bg-white/5 text-slate-400'}"
            aria-hidden="true">
            {place.isSummit ? '▲' : '●'}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-white">{place.name}</span>
            <span class="block truncate text-xs text-slate-400">
              {[place.kind, place.ele ? `${place.ele} m n.p.m.` : '', place.context].filter(Boolean).join(' · ')}
            </span>
          </span>
        </li>
      {/each}
    </ul>
  {:else if error}
    <p class="mt-2 text-xs text-red-300">{error}</p>
  {/if}
</div>

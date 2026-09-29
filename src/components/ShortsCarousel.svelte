<script lang="ts">
  import type { Video } from '../utils/youtube';

  let { shorts }: { shorts: Video[] } = $props();

  let track: HTMLElement;
  let atStart = $state(true);
  let atEnd = $state(false);

  function updateEdges() {
    atStart = track.scrollLeft <= 4;
    atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  }

  function scroll(direction: -1 | 1) {
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' });
  }

  const viewsFormat = new Intl.NumberFormat('pl-PL', { notation: 'compact', maximumFractionDigits: 1 });
</script>

<div class="relative">
  <div
    bind:this={track}
    onscroll={updateEdges}
    class="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
    {#each shorts as short (short.id)}
      <a
        href={`https://www.youtube.com/shorts/${short.id}`}
        target="_blank"
        rel="noopener noreferrer"
        class="group relative aspect-9/16 w-44 shrink-0 snap-start overflow-hidden rounded-2xl bg-ridetime-surface ring-1 ring-white/10 sm:w-52">
        <img
          src={short.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          class="size-full object-cover transition duration-500 group-hover:scale-105" />
        <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/10 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-3">
          <p class="line-clamp-3 text-sm leading-snug font-medium text-white">{short.title}</p>
          <p class="mt-1 text-xs text-slate-300">{viewsFormat.format(short.views)} wyświetleń</p>
        </div>
      </a>
    {/each}
  </div>

  <button
    type="button"
    aria-label="Poprzednie"
    disabled={atStart}
    onclick={() => scroll(-1)}
    class="absolute top-1/2 -left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ridetime-dark shadow-lg transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0 sm:grid">
    <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
  <button
    type="button"
    aria-label="Następne"
    disabled={atEnd}
    onclick={() => scroll(1)}
    class="absolute top-1/2 -right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ridetime-dark shadow-lg transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0 sm:grid">
    <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</div>

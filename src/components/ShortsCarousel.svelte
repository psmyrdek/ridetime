<script lang="ts">
  import type { VideoWithType } from '../utils/youtube';
  import { onMount } from 'svelte';

  export let shorts: VideoWithType[];

  let carouselContainer: HTMLElement;

  function scrollLeft() {
    carouselContainer.scrollBy({ left: -300, behavior: 'smooth' });
  }

  function scrollRight() {
    carouselContainer.scrollBy({ left: 300, behavior: 'smooth' });
  }

  onMount(() => {
    carouselContainer = document.querySelector('.carousel-container') as HTMLElement;
  });
</script>

<div class="relative w-full overflow-hidden">
  <button
    class="absolute left-0 top-[calc(50%-20px)] transform -translate-y-1/2 bg-sky-700 text-white p-2 rounded-r-lg z-10 flex items-center justify-center h-12"
    on:click={scrollLeft}>
    &lt;
  </button>
  <div class="flex overflow-x-scroll pb-4 hide-scrollbar carousel-container">
    {#each shorts as short (short.id)}
      <div class="flex-shrink-0 w-64 mr-4">
        <a href={`https://www.youtube.com/shorts/${short.id}`} target="_blank" rel="noopener noreferrer">
          <img
            src={short.snippet?.thumbnails?.medium?.url}
            alt={short.snippet?.title}
            class="w-full h-auto rounded-lg shadow-md" />
          <p class="mt-2 text-sm text-neutral-200 truncate">{short.snippet?.title}</p>
        </a>
      </div>
    {/each}
  </div>
  <button
    class="absolute right-0 top-[calc(50%-20px)] transform -translate-y-1/2 bg-sky-700 text-white p-2 rounded-l-lg z-10 flex items-center justify-center h-12"
    on:click={scrollRight}>
    &gt;
  </button>
</div>

<style>
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>

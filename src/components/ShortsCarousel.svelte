<script lang="ts">
  import type { VideoWithType } from '../utils/youtube';

  export let shorts: VideoWithType[];
</script>

<div class="relative w-full overflow-hidden">
  <div class="flex overflow-x-scroll pb-4 hide-scrollbar">
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

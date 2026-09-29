import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.ridetime.pl',
  integrations: [svelte()],
  server: {
    port: 3000,
  },
  adapter: vercel({
    webAnalytics: {
      enabled: false,
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
  devToolbar: {
    enabled: false,
  },
});

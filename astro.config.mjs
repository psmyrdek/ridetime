import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), svelte()],
  server: {
    port: 3000,
  },
  output: 'hybrid',
  adapter: vercel({
    webAnalytics: {
      enabled: false,
    },
  }),
  devToolbar: {
    enabled: false,
  },
});

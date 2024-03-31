import {defineConfig} from "astro/config";
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [
    tailwind(),
  ],
  server: {
    port: 3000,
  },
  output: 'hybrid',
  adapter: vercel({
    webAnalytics: {
      enabled: false
    }
  }),
});

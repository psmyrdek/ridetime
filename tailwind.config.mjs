/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'ridetime-light': '#9ACDFA',
        'ridetime-dark': '#1B4A7F'
      },
      fontFamily: {
        main: ["Francy", "sans-serif"],
      },
    },
  },
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'ridetime-light': '#9ACDFA',
        'ridetime-dark': 'rgb(8 19 32)',
      },
      fontFamily: {
        main: ['Francy', 'sans-serif'],
      },
    },
  },
};

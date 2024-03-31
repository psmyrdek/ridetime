/** @type {import('prettier').Config} */
module.exports = {
  printWidth: 120,
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
  bracketSameLine: true,

  plugins: [require.resolve('prettier-plugin-astro'), require.resolve('prettier-plugin-svelte')],

  overrides: [{ files: '*.astro', options: { parser: 'astro' } ,
  files: '*.svelte', options: { parser: 'svelte' } }],
  svelteSortOrder: "scripts-markup-styles-options"
};

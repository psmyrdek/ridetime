# Feature: Video archive page `/filmy`

Repo: Astro 7 + Svelte 5 (runes) + Tailwind 4 site for the RideTime YouTube channel. UI copy is Polish.
Data: `src/data/youtube.json` (videos + shorts), helpers in `src/utils/youtube.ts`
(`videos`, `shorts`, `formatDate`, `formatViews`, `cleanTitle`).

## Requirements

1. New page `src/pages/filmy.astro`. Same `<head>` conventions, `Header`, `Footer` and visual style as
   `src/pages/index.astro`. Polish title/description meta.
2. New Svelte 5 component (runes, `client:load` or `client:visible`) rendering the archive:
   - Tabs/segmented control: **Filmy** / **Shorts** (shorts use vertical 9:16 thumbnails, videos 16:9).
   - Search input filtering by title AND description. Case-insensitive and diacritic-insensitive
     (typing `zlobbing` matches `Żłobbing`, `kralova` matches `Králova`; note `ł` does not decompose under NFD).
   - Sort select: najnowsze (default), najstarsze, najpopularniejsze (views desc).
   - Result count ("N filmów" with correct Polish plural: 1 film, 2-4 filmy, 5+ filmów, 12-14 filmów, 22 filmy).
   - Empty state with a button that clears the search.
   - State synced to the URL query (`?typ=shorts&q=...&sort=...`), restored on load, default values omitted
     from the URL, using `history.replaceState`.
   - Each card links to YouTube (`/watch?v=` for videos, `/shorts/` for shorts), shows thumbnail, cleaned
     title, date, views. Accessible: labelled input/select, tabs with proper ARIA or buttons with `aria-pressed`.
3. Pure, framework-free filtering/sorting/plural logic in `src/utils/video-archive.ts` (exported, typed).
4. Add nav item `Archiwum` → `/filmy` in `src/components/Header.astro` (desktop + mobile; active state works).
   On the home page, change the "Więcej filmów" section's right-hand link to point to `/filmy` with label
   `Archiwum →`.
5. Must pass `npx astro check` (0 errors, 0 warnings) and `npx astro build`. Run `npx prettier --check` on the
   files you touched and fix formatting.
6. Commit your work on the current branch with a conventional commit message. Do not push.

Constraints: no new npm dependencies. Do not touch `src/data/*`. Follow existing code style.

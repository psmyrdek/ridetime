// Black-box acceptance test for the /filmy archive (tasks/filmy.md).
// Usage: node filmy.e2e.mjs <baseUrl> <repoDir> [--json]
// Expected values come from <repoDir>/src/data/youtube.json through a reference implementation,
// so the test keeps working after the daily data refresh.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const [base, repoDir] = process.argv.slice(2);
const asJson = process.argv.includes('--json');
if (!base || !repoDir) throw new Error('usage: node filmy.e2e.mjs <baseUrl> <repoDir> [--json]');

// Playwright is not a project dependency: use PLAYWRIGHT_MODULE or a global install.
const require = createRequire(import.meta.url);
const pwPath =
  process.env.PLAYWRIGHT_MODULE ??
  require.resolve('playwright', { paths: [process.cwd(), '/opt/node22/lib/node_modules'] });
const pw = await import(pwPath);
const { chromium } = pw.default ?? pw;

const feed = JSON.parse(readFileSync(join(repoDir, 'src/data/youtube.json'), 'utf8'));
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
const matches = (list, q) =>
  list.filter((v) =>
    fold(q)
      .split(/\s+/)
      .every((w) => fold(`${v.title} ${v.description}`).includes(w))
  );
const byViews = [...feed.videos].sort((a, b) => b.views - a.views);
const byDate = [...feed.videos].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
const plural = (n) => {
  const t = n % 100;
  if (n === 1) return 'film';
  return n % 10 >= 2 && n % 10 <= 4 && (t < 12 || t > 14) ? 'filmy' : 'filmów';
};
// Queries that exercise case folding, NFD accents, the non-decomposing "ł" and description search.
const firstWith = (re) => feed.videos.find((v) => re.test(v.title));
const lQuery =
  firstWith(/ł/i) &&
  fold(
    firstWith(/ł/i)
      .title.split(/\s+/)
      .find((w) => /ł/i.test(w))
  ).toUpperCase();
const descWord = feed.videos[0].description.split(/\s+/).find((w) => w.length > 8 && !/[^\p{L}]/u.test(w));
const shortsQuery = fold(feed.shorts[0].title.split(/\s+/)[0]);

const results = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const VID = 'main a[href*="youtube.com/watch?v="]';
const SH = 'main a[href*="youtube.com/shorts/"]';
const settle = () => page.waitForTimeout(600);
async function check(name, fn) {
  try {
    const r = await fn();
    results.push({ name, pass: r === true, detail: r === true ? '' : String(r) });
  } catch (e) {
    results.push({ name, pass: false, detail: String(e.message).split('\n')[0].slice(0, 120) });
  }
}
// Cards may hold several links (thumbnail + title), so count distinct targets.
const count = async (sel) => new Set(await page.locator(sel).evaluateAll((a) => a.map((x) => x.href))).size;
const firstHref = (sel) => page.locator(sel).first().getAttribute('href');
const search = () => page.locator('main input[type=search], main input[type=text]').first();
const type = async (q) => {
  await search().fill(q);
  await settle();
};
async function sortBy(re) {
  const sel = page.locator('main select').first();
  const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => [x.value, x.textContent]));
  await sel.selectOption(opts.find(([, t]) => re.test(t))[0]);
  await settle();
}
const tab = (re) =>
  page
    .locator('main')
    .getByRole('button', { name: re })
    .or(page.locator('main').getByRole('tab', { name: re }))
    .first();
const go = async (q = '') => {
  await page.goto(`${base}/filmy/${q}`);
  await page.waitForLoadState('networkidle');
  await settle();
};
const expectCount = async (sel, n) => (await count(sel)) === n || `got ${await count(sel)}, want ${n}`;
const mainText = () => page.locator('main').innerText();

const nV = feed.videos.length;
await go();
await check('default video cards', () => expectCount(VID, nV));
await check(
  `count text "${nV} ${plural(nV)}"`,
  async () => new RegExp(`(?<!\\d)${nV}\\s*${plural(nV)}(?!\\p{L})`, 'u').test(await mainText()) || 'missing'
);
await check('search folds NFD accents ("kralova")', async () => {
  await type('kralova');
  return expectCount(VID, matches(feed.videos, 'kralova').length);
});
await check('plural for search result count', async () => {
  const n = matches(feed.videos, 'kralova').length;
  return new RegExp(`(?<!\\d)${n}\\s*${plural(n)}(?!\\p{L})`, 'u').test(await mainText()) || `want "${n} ${plural(n)}"`;
});
await check(`search folds "ł" and case ("${lQuery}")`, async () => {
  if (!lQuery) return 'no title with ł in data';
  await type(lQuery);
  return expectCount(VID, matches(feed.videos, lQuery).length);
});
await check(`search covers description ("${descWord}")`, async () => {
  await type(descWord);
  return expectCount(VID, matches(feed.videos, descWord).length);
});
await check('sort najpopularniejsze', async () => {
  await type('');
  await sortBy(/popularn/i);
  return (await firstHref(VID)).includes(byViews[0].id) || `first is ${await firstHref(VID)}`;
});
await check('sort najstarsze', async () => {
  await sortBy(/najstarsze/i);
  return (await firstHref(VID)).includes(byDate[0].id) || `first is ${await firstHref(VID)}`;
});
await check('shorts tab', async () => {
  await sortBy(/najnowsze/i);
  await tab(/shorts/i).click();
  await settle();
  return expectCount(SH, feed.shorts.length);
});
await check('URL sync, default sort omitted', async () => {
  await type(shortsQuery);
  const u = new URL(page.url());
  return (
    (u.searchParams.get('typ') === 'shorts' &&
      u.searchParams.get('q') === shortsQuery &&
      !u.searchParams.has('sort')) ||
    u.search
  );
});
await check('state restored from URL', async () => {
  await go(`?typ=shorts&q=${encodeURIComponent(shortsQuery)}`);
  const want = matches(feed.shorts, shortsQuery).length;
  return (
    ((await count(SH)) === want && (await search().inputValue()) === shortsQuery) ||
    `${await count(SH)}/${want}, input "${await search().inputValue()}"`
  );
});
await check('sort restored from URL', async () => {
  await go('?sort=najpopularniejsze');
  return (await firstHref(VID)).includes(byViews[0].id) || `first is ${await firstHref(VID)}`;
});
await check('empty state clear button', async () => {
  await go('?q=xyzxyzxyz');
  if ((await count(VID)) !== 0) return 'cards shown for nonsense query';
  await page
    .locator('main button')
    .filter({ hasText: /wyczyść|pokaż wszystkie|resetuj|wyczysc/i })
    .first()
    .click();
  await settle();
  return expectCount(VID, nV);
});
await check('nav "Archiwum" active on /filmy', async () => {
  await go();
  return (
    (await page.locator('header a[href="/filmy"]').first().getAttribute('aria-current')) === 'page' || 'no aria-current'
  );
});
await check('home link "Archiwum" -> /filmy', async () => {
  await page.goto(`${base}/`);
  return (await page.locator('main a[href="/filmy"]', { hasText: 'Archiwum' }).count()) > 0 || 'missing';
});
await check('labelled search and select', async () => {
  await go();
  const labelled = (e) => !!(e.labels?.length || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby'));
  const s = await search().evaluate(labelled);
  const t = await page.locator('main select').first().evaluate(labelled);
  return (s && t) || `input:${s} select:${t}`;
});
await check('no console or page errors', () => errors.length === 0 || errors[0].slice(0, 120));
await browser.close();

const pass = results.filter((r) => r.pass).length;
if (asJson) {
  console.log(JSON.stringify({ pass, total: results.length, results }));
} else {
  for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.pass ? '' : ` - ${r.detail}`}`);
  console.log(`SCORE ${pass}/${results.length}`);
}

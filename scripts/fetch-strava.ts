// Pulls this year's ride totals and the latest activity from the Strava API and stores them in src/data/strava.json.
// Runs daily in GitHub Actions (.github/workflows/feeds.yml) next to the YouTube feed.
//
// Requires STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN (get one with `npm run strava:auth`).
// Strava may rotate the refresh token on refresh and invalidate the old one. When that happens the new token is
// written to STRAVA_TOKEN_FILE so the workflow can store it back as a repository secret.

import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../src/data/strava.json', import.meta.url);
const API = 'https://www.strava.com/api/v3';

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN, STRAVA_TOKEN_FILE } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
  console.warn('Strava credentials not set - skipping Strava refresh');
  process.exit(0);
}

interface Totals {
  count: number;
  distance: number;
  moving_time: number;
  elevation_gain: number;
}

interface Activity {
  id: number;
  name: string;
  sport_type: string;
  distance: number;
  total_elevation_gain: number;
  start_date: string;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: STRAVA_CLIENT_ID!,
      client_secret: STRAVA_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string; athlete?: { id: number } };
}

async function get<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const token = await refreshAccessToken(STRAVA_REFRESH_TOKEN);

if (token.refresh_token !== STRAVA_REFRESH_TOKEN) {
  if (STRAVA_TOKEN_FILE) {
    await writeFile(STRAVA_TOKEN_FILE, token.refresh_token);
    console.log('Strava issued a new refresh token - saved for the workflow to store');
  } else {
    console.warn(`Strava issued a new refresh token, update STRAVA_REFRESH_TOKEN: ${token.refresh_token}`);
  }
}

const athlete = await get<{ id: number }>('/athlete', token.access_token);
const [stats, [latest]] = await Promise.all([
  get<{ ytd_ride_totals: Totals }>(`/athletes/${athlete.id}/stats`, token.access_token),
  get<Activity[]>('/athlete/activities?per_page=1', token.access_token),
]);

const ytd = stats.ytd_ride_totals;
const round = (value: number, digits = 0) => Number(value.toFixed(digits));

const data = {
  year: new Date().getFullYear(),
  ytd: {
    rides: ytd.count,
    distanceKm: round(ytd.distance / 1000, 1),
    elevationM: round(ytd.elevation_gain),
    movingTimeH: round(ytd.moving_time / 3600),
  },
  latestActivity: latest
    ? {
        id: latest.id,
        name: latest.name,
        sportType: latest.sport_type,
        distanceKm: round(latest.distance / 1000, 1),
        elevationM: round(latest.total_elevation_gain),
        startDate: latest.start_date,
      }
    : null,
};

await writeFile(OUTPUT, JSON.stringify(data, null, 2) + '\n');
console.log(`Saved Strava stats: ${data.ytd.distanceKm} km over ${data.ytd.rides} rides in ${data.year}`);

import type { LatLng, RoutePoint } from './geo';
import roadBikeProfile from './road-bike.brf?raw';

/**
 * Open data sources, all callable from the browser:
 * - BRouter (https://brouter.de) – bike routing on OpenStreetMap with SRTM elevation for every point,
 * - Photon (https://photon.komoot.io) – OpenStreetMap geocoder for search and reverse lookups.
 */
const BROUTER_URL = 'https://brouter.de/brouter';
const PHOTON_URL = 'https://photon.komoot.io';
/** Built-in profile that also sticks to asphalt, used when the custom profile can't be uploaded. */
const FALLBACK_PROFILE = 'fastbike-verylowtraffic';

/**
 * BRouter has no road bike profile – fastbike happily takes dirt cycleways and footpaths, which turns e.g. Żar
 * into a 29% MTB climb. `road-bike.brf` keeps routes on paved roads; BRouter accepts custom profiles uploaded at
 * runtime (like brouter-web does) and deletes them after a while, so the upload is repeated when routing fails.
 */
let profileId: Promise<string> | undefined;

function uploadProfile(): Promise<string> {
  profileId ??= fetch(`${BROUTER_URL}/profile`, { method: 'POST', body: roadBikeProfile })
    .then((res) => res.json() as Promise<{ profileid?: string; error?: string }>)
    .then(({ profileid, error }) => {
      if (!profileid || error) throw new Error(error ?? 'BRouter: no profile id');
      return profileid;
    })
    .catch((e) => {
      console.warn('Road bike profile upload failed, falling back to', FALLBACK_PROFILE, e);
      return FALLBACK_PROFILE;
    });
  return profileId;
}

const routeCache = new Map<string, Promise<RoutePoint[]>>();

const key = (p: LatLng) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;

async function requestRoute(lonlats: string, profile: string): Promise<RoutePoint[]> {
  const params = new URLSearchParams({ lonlats, profile, alternativeidx: '0', format: 'geojson' });
  const res = await fetch(`${BROUTER_URL}?${params}`);
  const body = await res.text();
  // BRouter reports routing errors (e.g. a point far from any road) as plain text.
  if (!res.ok || !body.startsWith('{')) throw new Error(body.trim().split('\n')[0] || `BRouter: HTTP ${res.status}`);
  const coords: RoutePoint[] = JSON.parse(body).features[0].geometry.coordinates;
  if (coords.length < 2) throw new Error('Trasa jest zbyt krótka');
  return coords;
}

export function fetchRoute(start: LatLng, end: LatLng): Promise<RoutePoint[]> {
  const lonlats = `${key(start)}|${key(end)}`;
  const cached = routeCache.get(lonlats);
  if (cached) return cached;

  const request = (async () => {
    const upload = uploadProfile();
    const profile = await upload;
    try {
      return await requestRoute(lonlats, profile);
    } catch (e) {
      // An expired custom profile fails with an empty HTTP 500 – upload it again and retry once.
      if (profile === FALLBACK_PROFILE || !(e instanceof Error) || !e.message.startsWith('BRouter: HTTP')) throw e;
      if (profileId === upload) profileId = undefined;
      return requestRoute(lonlats, await uploadProfile());
    }
  })();
  routeCache.set(lonlats, request);
  request.catch(() => routeCache.delete(lonlats));
  return request;
}

export interface Place {
  id: string;
  name: string;
  kind: string;
  context: string;
  lat: number;
  lng: number;
  ele?: number;
  /** True for passes and peaks – good candidates for the finish of a climb. */
  isSummit: boolean;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

const KIND_LABELS: Record<string, string> = {
  saddle: 'przełęcz',
  mountain_pass: 'przełęcz',
  peak: 'szczyt',
  hill: 'wzgórze',
  volcano: 'szczyt',
  city: 'miasto',
  town: 'miasto',
  village: 'wieś',
  hamlet: 'osada',
  suburb: 'dzielnica',
  neighbourhood: 'osiedle',
  locality: 'miejsce',
  isolated_dwelling: 'przysiółek',
};

const SUMMIT_KINDS = new Set(['saddle', 'mountain_pass', 'peak', 'hill', 'volcano']);

function toPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const value = p.osm_key === 'mountain_pass' ? 'mountain_pass' : (p.osm_value ?? '');
  const context = [p.city ?? p.county, p.state, p.countrycode !== 'PL' ? p.country : undefined]
    .filter((part, i, all) => part && all.indexOf(part) === i && part !== p.name)
    .join(', ');
  return {
    id: `${p.osm_type}${p.osm_id}`,
    name: p.name ?? p.street ?? 'Bez nazwy',
    kind: KIND_LABELS[value] ?? p.osm_value?.replaceAll('_', ' ') ?? '',
    context,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    ele: p.ele ? Number.parseFloat(p.ele) : undefined,
    isSummit: SUMMIT_KINDS.has(value),
  };
}

export async function searchPlaces(query: string, near: LatLng, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lat: String(near.lat),
    lon: String(near.lng),
    location_bias_scale: '0.3',
  });
  for (const tag of ['place', 'natural:saddle', 'natural:peak', 'natural:hill', 'mountain_pass']) {
    params.append('osm_tag', tag);
  }
  const res = await fetch(`${PHOTON_URL}/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Photon: HTTP ${res.status}`);
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  // Exact name matches first, then passes – road climbs end on passes far more often than on peaks.
  // Photon's fuzzy matches (e.g. Slovak "Priehyb" for "Przehyba") stay behind; sort is stable otherwise.
  const normalize = (text: string) => text.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{M}/gu, '');
  const needle = normalize(query.trim());
  const rank = (p: Place) => (normalize(p.name).includes(needle) ? 0 : 2) + (p.kind === 'przełęcz' ? 0 : 1);
  return features
    .map(toPlace)
    .sort((a, b) => rank(a) - rank(b))
    .filter((p) => {
      const id = `${p.name}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

/** Nearest named place, used to name a climb whose finish was clicked on the map. */
export async function reverseGeocode(point: LatLng): Promise<Place | undefined> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), limit: '1', radius: '1' });
  const res = await fetch(`${PHOTON_URL}/reverse?${params}`);
  if (!res.ok) return undefined;
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  return features[0] ? toPlace(features[0]) : undefined;
}

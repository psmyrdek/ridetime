export interface LatLng {
  lat: number;
  lng: number;
}

/** BRouter coordinate: [lon, lat, elevation]. */
export type RoutePoint = [number, number, number];

export interface ProfilePoint {
  /** Distance from start in meters. */
  d: number;
  ele: number;
  lat: number;
  lng: number;
}

export interface Segment {
  from: number;
  to: number;
  grade: number;
}

export interface ClimbStats {
  length: number;
  gain: number;
  loss: number;
  startEle: number;
  topEle: number;
  avgGrade: number;
  maxGrade: number;
  fiets: number;
}

export interface Profile {
  points: ProfilePoint[];
  stats: ClimbStats;
}

const RESAMPLE_STEP = 10;
const SMOOTH_WINDOW = 5;
const MAX_GRADE_WINDOW = 100;

export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const t = Math.PI / 180;
  const dLat = (b[1] - a[1]) * t;
  const dLon = (b[0] - a[0]) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Turns raw route coordinates into an evenly spaced, lightly smoothed profile. SRTM elevations are noisy, so
 * gain and gradients are computed from the smoothed series.
 */
export function buildProfile(route: RoutePoint[]): Profile {
  const dist = [0];
  for (let i = 1; i < route.length; i++) {
    dist.push(dist[i - 1] + haversine([route[i - 1][0], route[i - 1][1]], [route[i][0], route[i][1]]));
  }
  const length = dist.at(-1) ?? 0;

  const raw: ProfilePoint[] = [];
  let j = 0;
  for (let d = 0; d <= length; d += RESAMPLE_STEP) {
    raw.push(interpolate(route, dist, d, j));
    while (j < dist.length - 2 && dist[j + 1] <= d) j++;
  }
  if (length - raw.at(-1)!.d > 0.5) raw.push(interpolate(route, dist, length, dist.length - 2));

  const half = Math.floor(SMOOTH_WINDOW / 2);
  const points = raw.map((p, i) => {
    const window = raw.slice(Math.max(0, i - half), i + half + 1);
    return { ...p, ele: window.reduce((sum, w) => sum + w.ele, 0) / window.length };
  });

  let gain = 0;
  let loss = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) gain += diff;
    else loss -= diff;
  }

  const span = Math.round(MAX_GRADE_WINDOW / RESAMPLE_STEP);
  let maxGrade = 0;
  for (let i = 0; i + span < points.length; i++) {
    maxGrade = Math.max(maxGrade, ((points[i + span].ele - points[i].ele) / (points[i + span].d - points[i].d)) * 100);
  }

  const startEle = points[0].ele;
  const topEle = Math.max(...points.map((p) => p.ele));
  const endEle = points.at(-1)!.ele;
  const netGain = endEle - startEle;
  const avgGrade = length > 0 ? (netGain / length) * 100 : 0;

  return {
    points,
    stats: {
      length,
      gain,
      loss,
      startEle,
      topEle,
      avgGrade,
      maxGrade: Math.max(maxGrade, avgGrade),
      fiets: fietsIndex(netGain, length, topEle),
    },
  };
}

function interpolate(route: RoutePoint[], dist: number[], d: number, from: number): ProfilePoint {
  let i = from;
  while (i < dist.length - 2 && dist[i + 1] < d) i++;
  const span = dist[i + 1] - dist[i];
  const t = span > 0 ? Math.min(1, Math.max(0, (d - dist[i]) / span)) : 0;
  const a = route[i];
  const b = route[i + 1] ?? a;
  return {
    d,
    lng: a[0] + (b[0] - a[0]) * t,
    lat: a[1] + (b[1] - a[1]) * t,
    ele: a[2] + (b[2] - a[2]) * t,
  };
}

/** FIETS climb difficulty index used by Dutch cycling magazine Fiets: H²/(D·10) + max(0, (T−1000)/1000). */
function fietsIndex(height: number, distance: number, top: number): number {
  if (distance <= 0 || height <= 0) return 0;
  return (height * height) / (distance * 10) + Math.max(0, (top - 1000) / 1000);
}

/** Picks a segment length that gives at most ~25 bars for the longest climb. */
export function segmentLength(maxLength: number): number {
  return [100, 200, 250, 500, 1000, 2000].find((step) => maxLength / step <= 25) ?? 5000;
}

export function segments(points: ProfilePoint[], step: number): Segment[] {
  const length = points.at(-1)?.d ?? 0;
  const result: Segment[] = [];
  for (let from = 0; from < length; from += step) {
    const to = Math.min(length, from + step);
    if (to - from < 1) break;
    const grade = ((elevationAt(points, to) - elevationAt(points, from)) / (to - from)) * 100;
    result.push({ from, to, grade });
  }
  return result;
}

export function pointAt(points: ProfilePoint[], d: number): ProfilePoint {
  if (d <= 0) return points[0];
  const last = points.at(-1)!;
  if (d >= last.d) return last;
  const step = points[1].d - points[0].d;
  const i = Math.min(points.length - 2, Math.floor(d / step));
  const a = points[i];
  const b = points[i + 1];
  const t = (d - a.d) / (b.d - a.d);
  return { d, ele: a.ele + (b.ele - a.ele) * t, lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

export function elevationAt(points: ProfilePoint[], d: number): number {
  return pointAt(points, d).ele;
}

/** Local gradient around `d`, measured over a 100 m window. */
export function gradeAt(points: ProfilePoint[], d: number): number {
  const length = points.at(-1)!.d;
  const from = Math.max(0, Math.min(d - MAX_GRADE_WINDOW / 2, length - MAX_GRADE_WINDOW));
  const to = Math.min(length, from + MAX_GRADE_WINDOW);
  if (to - from < 1) return 0;
  return ((elevationAt(points, to) - elevationAt(points, from)) / (to - from)) * 100;
}

export const GRADE_SCALE = [
  { min: -Infinity, label: '< 0%', color: '#64748b' },
  { min: 0, label: '0–3%', color: '#22c55e' },
  { min: 3, label: '3–6%', color: '#eab308' },
  { min: 6, label: '6–9%', color: '#f97316' },
  { min: 9, label: '9–12%', color: '#ef4444' },
  { min: 12, label: '12%+', color: '#d946ef' },
];

export function gradeColor(grade: number): string {
  return GRADE_SCALE.findLast((g) => grade >= g.min)!.color;
}

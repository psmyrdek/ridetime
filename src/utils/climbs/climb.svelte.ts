import { fetchRoute, reverseGeocode } from './api';
import { buildProfile, type LatLng, type Profile, type RoutePoint } from './geo';

export interface ClimbPreset {
  name: string;
  /** Where the climb starts, shown as a hint on the preset button. */
  side?: string;
  start: LatLng;
  end: LatLng;
}

/** Classic Polish road climbs; starts sit at the lowest point before the continuous ascent. */
export const PRESETS: ClimbPreset[] = [
  {
    name: 'Przegibek',
    side: 'z Bielska-Białej (Straconka)',
    start: { lat: 49.79609, lng: 19.09629 },
    end: { lat: 49.79316, lng: 19.12952 },
  },
  {
    name: 'Gliczarów',
    side: 'z Białego Dunajca',
    start: { lat: 49.38318, lng: 20.01779 },
    end: { lat: 49.34963, lng: 20.05138 },
  },
  {
    name: 'Przehyba',
    side: 'z Gabonia',
    start: { lat: 49.53247, lng: 20.55976 },
    end: { lat: 49.46561, lng: 20.56012 },
  },
  {
    name: 'Odrodzenie',
    side: 'z Przesieki',
    start: { lat: 50.8086, lng: 15.66538 },
    end: { lat: 50.76283, lng: 15.634 },
  },
];

export type ClimbId = 'a' | 'b';
export type ClickTarget = 'start' | 'end';

export class Climb {
  readonly id: ClimbId;
  readonly color: string;

  name = $state('');
  start = $state<LatLng | undefined>();
  end = $state<LatLng | undefined>();
  route = $state.raw<RoutePoint[] | undefined>();
  profile = $state.raw<Profile | undefined>();
  loading = $state(false);
  error = $state<string | undefined>();
  /** Which marker the next map click places. */
  clickTarget = $state<ClickTarget>('start');
  /** Distance (m) hovered on any chart, mirrored as a marker on the map. */
  hover = $state<number | undefined>();
  /**
   * Route the map should zoom to. Set only once a preset's route has loaded – fitting earlier would zoom to the
   * previous climb. A fresh object each time, so re-picking the same (cached) climb zooms again.
   */
  fitTarget = $state.raw<{ route: RoutePoint[] } | undefined>();

  #requestId = 0;
  #fitPending = false;
  /** False once the user types a name; until then the name follows presets, searches and the finish marker. */
  #autoName = true;

  constructor(id: ClimbId, color: string) {
    this.id = id;
    this.color = color;
  }

  get label() {
    return this.name || (this.id === 'a' ? 'Podjazd A' : 'Podjazd B');
  }

  setName(name: string) {
    this.name = name;
    this.#autoName = name === '';
  }

  /** Places a marker; the climb is renamed after the nearest place unless the user typed a name. */
  setPoint(target: ClickTarget, point: LatLng) {
    this[target] = point;
    if (target === 'start' && !this.end) this.clickTarget = 'end';
    if (target === 'end' && this.#autoName) {
      const requestId = this.#requestId + 1;
      reverseGeocode(point)
        .then((place) => place && this.#autoName && requestId === this.#requestId && (this.name = place.name))
        .catch(() => {});
    }
    void this.load();
  }

  /** A pass or peak picked in search becomes the new finish and names the climb – picking it is an explicit choice. */
  setFinish(point: LatLng, name: string) {
    // Replacing a whole climb drops its start; a start placed before picking the finish is kept.
    if (this.end) this.start = undefined;
    this.name = name;
    this.#autoName = true;
    this.end = point;
    this.clickTarget = 'start';
    void this.load();
  }

  applyPreset(preset: ClimbPreset) {
    this.name = preset.name;
    this.#autoName = true;
    this.start = preset.start;
    this.end = preset.end;
    this.clickTarget = 'end';
    this.#fitPending = true;
    void this.load();
  }

  reverse() {
    [this.start, this.end] = [this.end, this.start];
    void this.load();
  }

  clear() {
    this.#requestId++;
    this.start = this.end = undefined;
    this.route = this.profile = this.error = undefined;
    this.loading = false;
    this.clickTarget = 'start';
    this.setName('');
  }

  async load() {
    const { start, end } = this;
    const id = ++this.#requestId;
    this.error = undefined;
    if (!start || !end) {
      this.route = this.profile = undefined;
      return;
    }
    this.loading = true;
    try {
      const route = await fetchRoute(start, end);
      if (id !== this.#requestId) return;
      this.route = route;
      this.profile = buildProfile(route);
      if (this.#fitPending) this.fitTarget = { route };
      this.#fitPending = false;
    } catch (e) {
      if (id !== this.#requestId) return;
      this.#fitPending = false;
      this.route = this.profile = undefined;
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      if (id === this.#requestId) this.loading = false;
    }
  }

  serialize(): string | undefined {
    if (!this.start || !this.end) return undefined;
    const f = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    return [f(this.start), f(this.end), this.name].join('~');
  }

  restore(value: string): boolean {
    const [start, end, name = ''] = value.split('~');
    const parse = (s: string | undefined): LatLng | undefined => {
      const [lat, lng] = (s ?? '').split(',').map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    };
    const s = parse(start);
    const e = parse(end);
    if (!s || !e) return false;
    this.applyPreset({ name, start: s, end: e });
    return true;
  }
}

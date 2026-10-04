import type { StyleSpecification } from 'maplibre-gl';

/**
 * OpenFreeMap (https://openfreemap.org) – free OpenStreetMap vector tiles, no API key and no usage limits.
 * Positron is a minimal light style; we tune it into a road map for road cyclists: footpaths and trails are
 * hidden, and roads get more contrast so the network reads at a glance.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const BASEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const HIDDEN_LAYERS = new Set([
  'highway_path',
  'highway-name-path',
  'aeroway-taxiway',
  'railway_service',
  'railway_service_dashline',
]);

const ROAD_COLORS: Record<string, string> = {
  highway_minor: '#d3d6db',
  highway_major_casing: '#b9bec6',
  highway_major_inner: '#ffffff',
  highway_major_subtle: '#c2c7cf',
  highway_motorway_casing: '#aab0ba',
  highway_motorway_inner: '#ffffff',
  highway_motorway_subtle: '#b9bec6',
};

let style: Promise<StyleSpecification> | undefined;

export function loadBasemapStyle(): Promise<StyleSpecification> {
  style ??= fetch(STYLE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`OpenFreeMap: HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .then((spec) => ({
      ...spec,
      layers: spec.layers
        .filter((layer) => !HIDDEN_LAYERS.has(layer.id))
        .map((layer) =>
          layer.type === 'line' && ROAD_COLORS[layer.id]
            ? { ...layer, paint: { ...layer.paint, 'line-color': ROAD_COLORS[layer.id] } }
            : layer
        ),
    }));
  style.catch(() => (style = undefined));
  return style;
}

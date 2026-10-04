<script lang="ts">
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
  import { setWorkerUrl } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  // MapLibre v6 can't locate its worker inside a bundle; Vite's `?worker&url` emits a self-contained worker chunk.
  import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
  import { onMount } from 'svelte';
  import { BASEMAP_ATTRIBUTION, loadBasemapStyle } from '../../utils/climbs/basemap';
  import { pointAt } from '../../utils/climbs/geo';
  import type { Climb } from '../../utils/climbs/climb.svelte';

  interface Props {
    climb: Climb;
  }

  let { climb }: Props = $props();

  let container: HTMLDivElement;
  let map: L.Map | undefined = $state.raw();

  setWorkerUrl(maplibreWorkerUrl);

  const DEFAULT_VIEW: [number, number] = [49.73, 19.05];

  function pin(letter: string, className: string) {
    return L.divIcon({
      className: '',
      html: `<span class="climb-pin ${className}" style="--pin:${climb.color}">${letter}</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  export function flyTo(lat: number, lng: number, zoom = 14) {
    map?.flyTo([lat, lng], zoom, { duration: 0.8 });
  }

  onMount(() => {
    const instance = L.map(container, { zoomControl: false, attributionControl: true }).setView(DEFAULT_VIEW, 11);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.attributionControl.setPrefix(false);

    instance.attributionControl.addAttribution(BASEMAP_ATTRIBUTION);
    loadBasemapStyle()
      .then((style) => {
        // The map may have been torn down while the style was loading.
        if (map === instance) maplibreGL({ style, attributionControl: false }).addTo(instance);
      })
      .catch((e) => console.error('Basemap failed to load', e));

    instance.on('click', (e: L.LeafletMouseEvent) => climb.setPoint(climb.clickTarget, e.latlng));

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container);
    map = instance;

    return () => {
      observer.disconnect();
      instance.remove();
      map = undefined;
    };
  });

  // Start / finish markers, draggable to fine-tune the climb.
  $effect(() => {
    if (!map) return;
    const markers: L.Marker[] = [];
    for (const target of ['start', 'end'] as const) {
      const point = climb[target];
      if (!point) continue;
      const marker = L.marker(point, {
        icon: target === 'start' ? pin('S', 'climb-pin--start') : pin('M', 'climb-pin--end'),
        draggable: true,
        title: target === 'start' ? 'Start – przeciągnij, aby przesunąć' : 'Meta – przeciągnij, aby przesunąć',
        zIndexOffset: target === 'end' ? 100 : 0,
      }).addTo(map);
      marker.on('dragend', () => climb.setPoint(target, marker.getLatLng()));
      markers.push(marker);
    }
    return () => markers.forEach((m) => m.remove());
  });

  $effect(() => {
    const route = climb.route;
    if (!map || !route) return;
    const latlngs = route.map(([lng, lat]) => L.latLng(lat, lng));
    const casing = L.polyline(latlngs, { color: '#081320', weight: 8, opacity: 0.8, interactive: false }).addTo(map);
    const line = L.polyline(latlngs, { color: climb.color, weight: 4, interactive: false }).addTo(map);
    return () => {
      casing.remove();
      line.remove();
    };
  });

  $effect(() => {
    const target = climb.fitTarget;
    if (!map || !target) return;
    map.fitBounds(L.latLngBounds(target.route.map(([lng, lat]) => L.latLng(lat, lng))), { padding: [32, 32] });
  });

  // Mirrors the position hovered on the profile chart.
  $effect(() => {
    const { profile, hover } = climb;
    if (!map || !profile || hover === undefined) return;
    const p = pointAt(profile.points, hover);
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: climb.color,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    return () => marker.remove();
  });
</script>

<div bind:this={container} class="climb-map size-full"></div>

<style>
  .climb-map {
    background: #f2efe9;
    cursor: crosshair;
    font: inherit;
  }

  .climb-map :global(.climb-pin) {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    color: #081320;
    background: var(--pin);
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.5);
  }

  .climb-map :global(.climb-pin--start) {
    background: #fff;
    border-color: var(--pin);
  }

  .climb-map :global(.leaflet-control-attribution) {
    background: rgb(8 19 32 / 0.75);
    color: rgb(148 163 184);
    font-size: 10px;
  }

  .climb-map :global(.leaflet-control-attribution a) {
    color: var(--color-ridetime-light);
  }

  .climb-map :global(.leaflet-bar a) {
    background: var(--color-ridetime-surface);
    color: rgb(226 232 240);
    border-color: rgb(255 255 255 / 0.1);
  }

  .climb-map:global(.leaflet-grab) {
    cursor: crosshair;
  }

  .climb-map :global(.leaflet-marker-draggable) {
    cursor: grab;
  }
</style>

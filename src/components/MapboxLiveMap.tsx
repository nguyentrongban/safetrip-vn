import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, Marker as MapboxMarker, GeoJSONSource } from 'mapbox-gl';
import type { LiveRow } from '../utils/live';
import {
  MAPBOX_STREET_STYLE,
  addLandmarkMarkers,
  addSovereigntyMarkers,
  applyBrandPaint,
  loadMapboxGL,
  watchMapboxMap,
  type MapboxGL,
} from '../utils/mapbox';
import type { SavedView } from '../hooks/useMapEngine';

interface Props {
  row: LiveRow | null;
  trail: [number, number][];
  initialView?: SavedView | null;
  onFail: (reason: string, view?: SavedView | null) => void;
}

const VN_CENTER: [number, number] = [108.2772, 14.0583]; // [lng, lat]
const DOT_HTML = '<div style="width:28px;height:28px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.5);animation:livepulse 1.6s infinite"></div>';

/**
 * Family live-viewer map on Mapbox GL. The tracked dot GLIDES between the
 * 10-second position updates (Grab-style) instead of jumping. Any engine
 * failure is reported via onFail; the wrapper swaps in the Leaflet map.
 */
export default function MapboxLiveMap({ row, trail, initialView, onFail }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const glRef = useRef<MapboxGL | null>(null);
  const dotRef = useRef<MapboxMarker | null>(null);
  const bootIdRef = useRef(0);
  const failedRef = useRef(false);
  const loadedRef = useRef(false);
  const firstRowRef = useRef(true);
  const displayedRef = useRef<[number, number] | null>(null); // [lng, lat] currently shown
  const glideRef = useRef<number | null>(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const rowRef = useRef(row);
  rowRef.current = row;

  /* ---------------- boot (once) ---------------- */
  useEffect(() => {
    const bootId = ++bootIdRef.current;
    let cleanupWatchdog: (() => void) | null = null;
    let cancelled = false;

    const fail = (reason: string) => {
      if (failedRef.current) return;
      failedRef.current = true;
      const map = mapRef.current;
      let view: SavedView | null = null;
      if (map) {
        try {
          const c = map.getCenter();
          view = { center: [c.lat, c.lng], zoom: map.getZoom() };
        } catch { /* noop */ }
      }
      onFailRef.current(reason, view);
    };

    void (async () => {
      let gl: MapboxGL;
      try {
        gl = await loadMapboxGL();
      } catch {
        fail('dynamic-import-failed');
        return;
      }
      if (cancelled || bootId !== bootIdRef.current) return;
      glRef.current = gl;

      let supported = false;
      try { supported = gl.supported(); } catch { supported = false; }
      if (!supported) { fail('webgl-unavailable'); return; }
      if (!containerRef.current) { fail('container-missing'); return; }

      let map: MapboxMap;
      try {
        map = new gl.Map({
          container: containerRef.current,
          style: MAPBOX_STREET_STYLE,
          center: initialView ? [initialView.center[1], initialView.center[0]] : VN_CENTER,
          zoom: initialView?.zoom ?? 6,
          attributionControl: false,
          antialias: false,
        });
      } catch (e) {
        fail(`map-construction-failed: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
      mapRef.current = map;
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-left');
      map.addControl(new gl.AttributionControl({ compact: true }), 'bottom-right');
      cleanupWatchdog = watchMapboxMap(map, fail);

      map.on('load', () => {
        if (cancelled || failedRef.current) return;
        loadedRef.current = true;
        applyBrandPaint(map, { satellite: false });
        addSovereigntyMarkers(map);
        addLandmarkMarkers(map);
        map.addSource('safetrip-trail', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'safetrip-trail-line', type: 'line', source: 'safetrip-trail',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.8 },
        });
        const r = rowRef.current;
        if (r) {
          const el = document.createElement('div');
          el.innerHTML = DOT_HTML;
          dotRef.current = new gl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
          displayedRef.current = [r.lng, r.lat];
        }
      });
    })();

    return () => {
      cancelled = true;
      bootIdRef.current += 1;
      if (glideRef.current !== null) cancelAnimationFrame(glideRef.current);
      if (cleanupWatchdog) cleanupWatchdog();
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      dotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- tracked dot: glide + camera follow ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || !row || failedRef.current || !loadedRef.current) return;

    const target: [number, number] = [row.lng, row.lat];
    if (!dotRef.current) {
      const el = document.createElement('div');
      el.innerHTML = DOT_HTML;
      dotRef.current = new gl.Marker({ element: el }).setLngLat(target).addTo(map);
      displayedRef.current = target;
    }

    // Camera: first fix zooms in (like the Leaflet Follow), later fixes pan.
    if (firstRowRef.current) {
      firstRowRef.current = false;
      map.jumpTo({ center: target, zoom: 14 });
      dotRef.current.setLngLat(target);
      displayedRef.current = target;
      return;
    }
    map.easeTo({ center: target, duration: 900 });

    // Glide the dot from wherever it is displayed to the new fix (~0.9 s).
    const from = displayedRef.current ?? target;
    if (glideRef.current !== null) cancelAnimationFrame(glideRef.current);
    const start = performance.now();
    const DURATION = 900;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const pos: [number, number] = [
        from[0] + (target[0] - from[0]) * e,
        from[1] + (target[1] - from[1]) * e,
      ];
      displayedRef.current = pos;
      dotRef.current?.setLngLat(pos);
      if (t < 1) glideRef.current = requestAnimationFrame(step);
      else glideRef.current = null;
    };
    glideRef.current = requestAnimationFrame(step);
  }, [row]);

  /* ---------------- trail ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || failedRef.current || !loadedRef.current) return;
    const src = map.getSource('safetrip-trail') as GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: trail.map(([la, ln]) => [ln, la] as [number, number]) },
    });
  }, [trail]);

  return (
    <>
      <style>{'@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}70%{box-shadow:0 0 0 16px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}} .mapboxgl-map{font-family:inherit}'}</style>
      <div ref={containerRef} className="w-full h-full" style={{ background: '#0F172A' }} />
    </>
  );
}

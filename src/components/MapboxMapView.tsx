import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import { BORDER_LINES, BORDER_POINTS, BORDER_RADIUS_KM } from '../utils/data';
import type { PlacePoint } from '../types';
import {
  MAPBOX_SATELLITE_STYLE,
  MAPBOX_STREET_STYLE,
  addLandmarkMarkers,
  addSovereigntyMarkers,
  applyBrandPaint,
  circlePolygon,
  loadMapboxGL,
  watchMapboxMap,
  type MapboxGL,
} from '../utils/mapbox';
import type { SavedView } from '../hooks/useMapEngine';

interface Props {
  lat: number | null;
  lng: number | null;
  onFail: (reason: string, view?: SavedView | null) => void;
  /** Predicted-route polyline ([lat, lng] pairs) to draw, if any. */
  route?: [number, number][] | null;
  /** Destination point to flag, if picked. */
  dest?: PlacePoint | null;
}

const DEST_HTML = '<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:2.5px solid #10B981;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(15,23,42,.35)">🏁</div>';

/** Predicted-route line (white casing + sky core). Idempotent; the
 * source data is swapped in place when the route changes. */
function upsertRouteLayer(map: MapboxMap, route: [number, number][] | null): void {
  const data = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: (route ?? []).map(([la, ln]) => [ln, la] as [number, number]),
    },
  };
  const src = map.getSource('safetrip-route') as GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource('safetrip-route', { type: 'geojson', data });
  const before = map.getLayer('safetrip-islands-flag') ? 'safetrip-islands-flag' : undefined;
  map.addLayer({
    id: 'safetrip-route-casing', type: 'line', source: 'safetrip-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.8 },
  }, before);
  map.addLayer({
    id: 'safetrip-route-core', type: 'line', source: 'safetrip-route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#0EA5E9', 'line-width': 4.5, 'line-opacity': 0.95 },
  }, before);
}

const VN_CENTER: [number, number] = [108.2772, 14.0583]; // [lng, lat]
const USER_DOT_HTML = '<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.35);animation:pulse 1.4s infinite"></div>';

/** Border polylines (glowing) + 15 km gate circles. Idempotent — safe to
 * re-run after setStyle wipes the style's sources/layers. */
function addCustomLayers(map: MapboxMap, gl: MapboxGL): void {
  if (!map.getSource('safetrip-borders')) {
    map.addSource('safetrip-borders', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: BORDER_LINES.map((line) => ({
          type: 'Feature' as const,
          properties: { name: line.name },
          geometry: { type: 'LineString' as const, coordinates: line.points.map(([la, ln]) => [ln, la] as [number, number]) },
        })),
      },
    });
  }
  if (!map.getSource('safetrip-gate-circles')) {
    map.addSource('safetrip-gate-circles', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: BORDER_POINTS.map((b) => ({
          type: 'Feature' as const,
          properties: { id: b.id },
          geometry: { type: 'Polygon' as const, coordinates: [circlePolygon(b.lat, b.lng, BORDER_RADIUS_KM)] },
        })),
      },
    });
  }
  if (!map.getLayer('safetrip-gate-circles-fill')) {
    map.addLayer({ id: 'safetrip-gate-circles-fill', type: 'fill', source: 'safetrip-gate-circles', paint: { 'fill-color': '#EF4444', 'fill-opacity': 0.1 } });
  }
  if (!map.getLayer('safetrip-gate-circles-line')) {
    map.addLayer({ id: 'safetrip-gate-circles-line', type: 'line', source: 'safetrip-gate-circles', paint: { 'line-color': '#EF4444', 'line-width': 1.5, 'line-opacity': 0.9 } });
  }
  if (!map.getLayer('safetrip-border-glow')) {
    map.addLayer({
      id: 'safetrip-border-glow', type: 'line', source: 'safetrip-borders',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#EF4444', 'line-width': 16, 'line-opacity': 0.13, 'line-blur': 4 },
    });
  }
  if (!map.getLayer('safetrip-border-core')) {
    map.addLayer({
      id: 'safetrip-border-core', type: 'line', source: 'safetrip-borders',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#EF4444', 'line-width': 2.5, 'line-opacity': 0.95, 'line-dasharray': [2.8, 2.4] },
    });
    map.on('click', 'safetrip-border-core', (e) => {
      const name = e.features?.[0]?.properties?.name as string | undefined;
      new gl.Popup({ offset: 12 })
        .setLngLat(e.lngLat)
        .setHTML(`<b>${name ?? 'Đường biên giới'}</b><br/>Đường biên giới thật — đường mòn, lối mở có thể xuất hiện ở bất kỳ đoạn nào. App báo động khi bạn cách đường này dưới 10km.`)
        .addTo(map);
    });
    map.on('mouseenter', 'safetrip-border-core', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'safetrip-border-core', () => { map.getCanvas().style.cursor = ''; });
  }
  addSovereigntyMarkers(map);
  addLandmarkMarkers(map);
}

function addGateMarkers(map: MapboxMap, gl: MapboxGL): void {
  for (const b of BORDER_POINTS) {
    const el = document.createElement('div');
    el.style.fontSize = '20px';
    el.style.lineHeight = '1';
    el.textContent = '🚩';
    const popup = new gl.Popup({ offset: 14 }).setHTML(
      `<b>${b.name}</b><br/>${b.province} — biên giới ${b.country}<br/>${b.dangerNote}`,
    );
    new gl.Marker({ element: el }).setLngLat([b.lng, b.lat]).setPopup(popup).addTo(map);
  }
}

/**
 * Giám Sát monitor map on Mapbox GL (vector, SafeTrip-branded night style).
 * Any engine failure is reported through onFail — the wrapper then swaps in
 * the Leaflet map at the same view, silently.
 */
export default function MapboxMapView({ lat, lng, onFail, route = null, dest = null }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const glRef = useRef<MapboxGL | null>(null);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const destMarkerRef = useRef<MapboxMarker | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const destRef = useRef(dest);
  destRef.current = dest;
  const bootIdRef = useRef(0);
  const failedRef = useRef(false);
  const loadedRef = useRef(false);
  const [mode, setMode] = useState<'street' | 'satellite'>('street');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const posRef = useRef<{ lat: number | null; lng: number | null }>({ lat, lng });
  posRef.current = { lat, lng };
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

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
        } catch { /* map already gone */ }
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

      const { lat: la, lng: ln } = posRef.current;
      let map: MapboxMap;
      try {
        map = new gl.Map({
          container: containerRef.current,
          style: MAPBOX_STREET_STYLE,
          center: la !== null && ln !== null ? [ln, la] : VN_CENTER,
          zoom: la !== null ? 12 : 6,
          attributionControl: false,
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
        applyBrandPaint(map, { satellite: modeRef.current === 'satellite' });
        addCustomLayers(map, gl);
        addGateMarkers(map, gl);
        upsertRouteLayer(map, routeRef.current);
        syncDestMarker();
        const { lat: pla, lng: pln } = posRef.current;
        if (pla !== null && pln !== null && !userMarkerRef.current) {
          const el = document.createElement('div');
          el.innerHTML = USER_DOT_HTML;
          userMarkerRef.current = new gl.Marker({ element: el }).setLngLat([pln, pla]).addTo(map);
        }
      });
    })();

    return () => {
      cancelled = true;
      bootIdRef.current += 1;
      if (cleanupWatchdog) cleanupWatchdog();
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* noop */ }
        mapRef.current = null;
      }
      userMarkerRef.current = null;
      destMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- follow user ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || failedRef.current || lat === null || lng === null) return;
    if (loadedRef.current) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = USER_DOT_HTML;
        userMarkerRef.current = new gl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      } else {
        userMarkerRef.current.setLngLat([lng, lat]);
      }
    }
    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
  }, [lat, lng]);

  /* ---------------- route line + destination flag ---------------- */
  const syncDestMarker = () => {
    const map = mapRef.current;
    const gl = glRef.current;
    const d = destRef.current;
    if (!map || !gl || failedRef.current || !loadedRef.current) return;
    if (d) {
      if (!destMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = DEST_HTML;
        destMarkerRef.current = new gl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
      } else {
        destMarkerRef.current.setLngLat([d.lng, d.lat]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || failedRef.current || !loadedRef.current) return;
    try { upsertRouteLayer(map, route); } catch { /* style mid-swap */ }
    syncDestMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, dest]);

  /* ---------------- street / satellite toggle ---------------- */
  const switchMode = (m: 'street' | 'satellite') => {
    if (m === mode) return;
    setMode(m);
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || failedRef.current) return;
    map.setStyle(m === 'satellite' ? MAPBOX_SATELLITE_STYLE : MAPBOX_STREET_STYLE);
    map.once('style.load', () => {
      if (failedRef.current) return;
      applyBrandPaint(map, { satellite: m === 'satellite' });
      addCustomLayers(map, gl);
      upsertRouteLayer(map, routeRef.current);
    });
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-700 h-[340px] md:h-[440px] lg:h-[560px]">
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .mapboxgl-map{font-family:inherit} .mapboxgl-popup-content{background:#1E293B;color:#F1F5F9;border-radius:12px;font-size:13px} .mapboxgl-popup-tip{border-top-color:#1E293B!important;border-bottom-color:#1E293B!important}'}</style>
      <div ref={containerRef} className="w-full h-full" style={{ background: '#EAF6FD' }} />
      <div className="absolute top-2 right-2 z-[500] flex rounded-xl overflow-hidden border border-slate-600 shadow-lg text-[11px] font-bold">
        <button onClick={() => switchMode('street')} className={`px-2.5 py-1.5 ${mode === 'street' ? 'bg-blue-600 text-white' : 'bg-slate-900/90 text-slate-300'}`}>🗺️ Đường</button>
        <button onClick={() => switchMode('satellite')} className={`px-2.5 py-1.5 ${mode === 'satellite' ? 'bg-blue-600 text-white' : 'bg-slate-900/90 text-slate-300'}`}>🛰️ Vệ tinh</button>
      </div>
    </div>
  );
}

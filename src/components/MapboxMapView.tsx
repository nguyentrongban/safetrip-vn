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
import { FALLBACK_RADIUS_M, ZONE_TYPE_META, groupZoneReports, type CommuneZone, type DangerZoneType, type ZoneGeometry } from '../utils/dangerZones';

interface Props {
  lat: number | null;
  lng: number | null;
  onFail: (reason: string, view?: SavedView | null) => void;
  /** Predicted-route polyline ([lat, lng] pairs) to draw, if any. */
  route?: [number, number][] | null;
  /** Destination point to flag, if picked. */
  dest?: PlacePoint | null;
  /** true: camera follows the user. false (setup preview): frame the
   * whole route instead. */
  followUser?: boolean;
  /** Approved danger communes to tint by their real boundary (v1.42). */
  zones?: CommuneZone[];
  /** A grouped popup row was tapped — open the detail sheet for that
   *  commune + report type (owner 2026-11-06). */
  onZoneGroup?: (zone: CommuneZone, type: DangerZoneType) => void;
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

/** Community danger zones (v1.41): tinted circles, one GeoJSON source
 * with a per-feature color. Zone text is community-written (and owner-
 * moderated) — still escaped before it lands in popup HTML. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function zonePopupHtml(z: CommuneZone): string {
  // Grouped by type (owner 2026-11-06): ONE compact tappable row per
  // report type with the totals; the per-report detail (description,
  // date, confirm button) lives in the React sheet behind the row.
  const rows = groupZoneReports(z).map((g) => {
    const meta = ZONE_TYPE_META[g.type];
    return `<button type="button" class="st-zone-row" data-zkey="${escapeHtml(z.key)}" data-ztype="${g.type}"><span style="display:block;font-weight:800;color:${meta.color}">${escapeHtml(meta.label)}</span><span style="display:block;font-size:12px;color:#CBD5E1;margin-top:1px">${g.reports.length} báo cáo · ${g.totalConfirms} lượt xác nhận · Xem chi tiết ›</span></button>`;
  }).join('');
  const fallback = z.geometry ? '' : '<div style="font-size:11px;color:#94A3B8;margin-top:6px"><i>Ranh giới xã/phường này chưa có dữ liệu bản đồ — vòng tròn là vị trí báo cáo gần đúng.</i></div>';
  return `<div style="max-height:36vh;overflow-y:auto"><div style="font-size:14px"><b>⚠️ ${escapeHtml(z.wardName)}</b> — ${escapeHtml(z.provinceName)}</div><div style="margin-top:2px">${rows}</div>${fallback}<div style="font-size:11px;color:#94A3B8;margin-top:6px"><i>Tin cộng đồng, chưa kiểm chứng — chỉ để tham khảo phòng tránh.</i></div></div>`;
}

interface ZoneClickBridge {
  current: { zones: CommuneZone[]; onGroup?: (zone: CommuneZone, type: DangerZoneType) => void };
}

function upsertZonesLayer(map: MapboxMap, gl: MapboxGL, zones: CommuneZone[], zoneClick: ZoneClickBridge): void {
  const features: { type: 'Feature'; properties: { color: string; body: string }; geometry: ZoneGeometry | { type: 'Polygon'; coordinates: [number, number][][] } }[] = [];
  for (const z of zones) {
    if (z.geometry) {
      features.push({ type: 'Feature', properties: { color: ZONE_TYPE_META[z.topType].color, body: zonePopupHtml(z) }, geometry: z.geometry });
    } else if (z.centroid) {
      features.push({
        type: 'Feature',
        properties: { color: ZONE_TYPE_META[z.topType].color, body: zonePopupHtml(z) },
        geometry: { type: 'Polygon', coordinates: [circlePolygon(z.centroid.lat, z.centroid.lng, FALLBACK_RADIUS_M / 1000)] },
      });
    }
  }
  const data = { type: 'FeatureCollection' as const, features };
  const src = map.getSource('safetrip-danger-zones') as GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource('safetrip-danger-zones', { type: 'geojson', data });
  const before = map.getLayer('safetrip-islands-flag') ? 'safetrip-islands-flag' : undefined;
  map.addLayer({
    id: 'safetrip-danger-zones-fill', type: 'fill', source: 'safetrip-danger-zones',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 },
  }, before);
  map.addLayer({
    id: 'safetrip-danger-zones-line', type: 'line', source: 'safetrip-danger-zones',
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.9 },
  }, before);
  map.on('click', 'safetrip-danger-zones-fill', (e) => {
    const p = e.features?.[0]?.properties as { body?: string } | undefined;
    if (!p?.body) return;
    const popup = new gl.Popup({ offset: 12, maxWidth: '320px' })
      .setLngLat(e.lngLat)
      .setHTML(p.body)
      .addTo(map);
    // Grouped rows are real <button>s in the popup HTML — bridge their
    // taps back into React (detail sheet) via the live zones ref.
    popup.getElement()?.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('[data-ztype]') as HTMLElement | null;
      if (!btn) return;
      const zone = zoneClick.current.zones.find((zz) => zz.key === btn.getAttribute('data-zkey'));
      const type = btn.getAttribute('data-ztype') as DangerZoneType | null;
      if (zone && type) {
        popup.remove();
        zoneClick.current.onGroup?.(zone, type);
      }
    });
  });
  map.on('mouseenter', 'safetrip-danger-zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'safetrip-danger-zones-fill', () => { map.getCanvas().style.cursor = ''; });
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
export default function MapboxMapView({ lat, lng, onFail, route = null, dest = null, followUser = true, zones = [], onZoneGroup }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const glRef = useRef<MapboxGL | null>(null);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const destMarkerRef = useRef<MapboxMarker | null>(null);
  const routeRef = useRef(route);
  routeRef.current = route;
  const destRef = useRef(dest);
  destRef.current = dest;
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const zoneClickRef: ZoneClickBridge = useRef({ zones, onGroup: onZoneGroup });
  zoneClickRef.current = { zones, onGroup: onZoneGroup };
  const followUserRef = useRef(followUser);
  followUserRef.current = followUser;
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
        applyBrandPaint(map, { satellite: modeRef.current === 'satellite' });
        addCustomLayers(map, gl);
        addGateMarkers(map, gl);
        upsertRouteLayer(map, routeRef.current);
        upsertZonesLayer(map, gl, zonesRef.current, zoneClickRef);
        syncDestMarker();
        if (routeRef.current && routeRef.current.length > 1 && !followUserRef.current) {
          fitKeyRef.current = `${routeRef.current.length}|${routeRef.current[0][0]},${routeRef.current[0][1]}`;
          fitToRoute(routeRef.current);
        }
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
    if (followUser) {
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 800 });
    }
  }, [lat, lng, followUser]);

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

  /* ---------------- danger zones (v1.41) ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl || failedRef.current || !loadedRef.current) return;
    try { upsertZonesLayer(map, gl, zones, zoneClickRef); } catch { /* style mid-swap */ }
  }, [zones]);

  /* ---------------- frame the whole route (setup preview) ---------- */
  const fitKeyRef = useRef('');
  const fitToRoute = (r: [number, number][]) => {
    const map = mapRef.current;
    if (!map || r.length < 2) return;
    let minLa = 90, maxLa = -90, minLn = 180, maxLn = -180;
    for (const [la, ln] of r) {
      if (la < minLa) minLa = la;
      if (la > maxLa) maxLa = la;
      if (ln < minLn) minLn = ln;
      if (ln > maxLn) maxLn = ln;
    }
    try { map.fitBounds([[minLn, minLa], [maxLn, maxLa]], { padding: 48, maxZoom: 15, duration: 700 }); } catch { /* noop */ }
  };
  useEffect(() => {
    if (!route || route.length < 2 || followUser || !loadedRef.current) return;
    const key = `${route.length}|${route[0][0]},${route[0][1]}|${route[route.length - 1][0]},${route[route.length - 1][1]}`;
    if (fitKeyRef.current === key) return;
    fitKeyRef.current = key;
    fitToRoute(route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, followUser]);

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
      upsertZonesLayer(map, gl, zonesRef.current, zoneClickRef);
    });
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 h-[340px] md:h-[440px] lg:h-[560px]">
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .mapboxgl-map{font-family:inherit} .mapboxgl-popup-content{background:#1E293B;color:#F1F5F9;border-radius:12px;font-size:13px} .mapboxgl-popup-tip{border-top-color:#1E293B!important;border-bottom-color:#1E293B!important} .st-zone-row{display:block;width:100%;text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 10px;margin-top:6px;cursor:pointer;font:inherit;color:inherit}'}</style>
      <div ref={containerRef} className="w-full h-full" style={{ background: '#EAF6FD' }} />
      <div className="absolute top-2 right-2 z-[500] flex rounded-xl overflow-hidden border border-slate-600 shadow-lg text-[11px] font-bold">
        <button onClick={() => switchMode('street')} className={`px-2.5 py-1.5 ${mode === 'street' ? 'bg-blue-600 text-white' : 'bg-black/30/90 text-slate-300'}`}>🗺️ Đường</button>
        <button onClick={() => switchMode('satellite')} className={`px-2.5 py-1.5 ${mode === 'satellite' ? 'bg-blue-600 text-white' : 'bg-black/30/90 text-slate-300'}`}>🛰️ Vệ tinh</button>
      </div>
      {route && route.length > 1 && (
        <button
          onClick={() => fitToRoute(route)}
          className="absolute top-11 right-2 z-[500] px-2.5 py-1.5 rounded-xl border border-slate-600 shadow-lg text-[11px] font-bold bg-black/30/90 text-slate-200"
        >
          🛣 Toàn tuyến
        </button>
      )}
    </div>
  );
}

import { Fragment, useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BORDER_LINES, BORDER_POINTS, BORDER_RADIUS_KM, ISLAND_GROUPS, LANDMARKS, SEA_LABEL } from '../utils/data';
import { FALLBACK_RADIUS_M, ZONE_TYPE_META, confirmDangerZone, formatZoneDate, type CommuneZone, type ZoneGeometry } from '../utils/dangerZones';

/** GeoJSON [lng, lat] rings → Leaflet [lat, lng] positions. */
function geometryToLeaflet(geom: ZoneGeometry): [number, number][][] | [number, number][][][] {
  const ring = (r: [number, number][]) => r.map(([lng, lat]) => [lat, lng] as [number, number]);
  if (geom.type === 'Polygon') return geom.coordinates.map(ring);
  return geom.coordinates.map((poly) => poly.map(ring));
}

/** Popup body shared by the real-boundary polygon and the fallback
 * circle: every approved report for the commune, each with its source,
 * freshness date and a re-confirm button. */
function ZonePopupContent({ zone }: { zone: CommuneZone }) {
  return (
    <>
      <b>⚠️ {zone.wardName}</b> — {zone.provinceName}<br />
      {zone.reports.map((r) => (
        <span key={r.id}>
          <b style={{ color: ZONE_TYPE_META[r.type].color }}>{ZONE_TYPE_META[r.type].label}</b><br />
          {r.description}<br />
          <i>Nguồn: cộng đồng · Cập nhật {formatZoneDate(r.updatedAt)} · {r.confirmCount} lượt xác nhận</i>
          <br />
          <button
            onClick={() => void confirmDangerZone(r.id)}
            style={{ margin: '4px 0 8px', background: '#0F172A', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
          >
            ✓ Vẫn còn nguy hiểm — xác nhận
          </button>
          <br />
        </span>
      ))}
      {!zone.geometry && <i>Ranh giới xã/phường này chưa có dữ liệu bản đồ — vòng tròn là vị trí báo cáo gần đúng.</i>}
    </>
  );
}

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.35);animation:pulse 1.4s infinite"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const borderIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:20px;line-height:1">🚩</div>', iconSize: [20, 20], iconAnchor: [10, 10],
});

/** Sovereignty marker: a pinned Vietnam flag + bilingual name pill
 * (Hoàng Sa / Paracel Islands · Vietnam). Always rendered, above tiles. */
const islandIcon = (short: string, en: string) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
    <div style="width:38px;height:28px;border-radius:6px;background:#DA251D;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,.4)">
      <svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.9 7.5.7-5.6 5 1.6 7.4L12 18l-6.6 3.8L7 14.4 1.4 9.4l7.5-.7z" fill="#FFDE00"/></svg>
    </div>
    <div style="background:rgba(255,255,255,.94);border:1.5px solid #F59E0B;border-radius:999px;padding:2px 9px;text-align:center;line-height:1.15;box-shadow:0 2px 8px rgba(15,23,42,.25)">
      <div style="font-size:11.5px;font-weight:800;color:#9A3412;white-space:nowrap">${short}</div>
      <div style="font-size:9px;font-weight:700;color:#475569;white-space:nowrap">${en} · Vietnam</div>
    </div>
  </div>`,
  iconSize: [150, 66], iconAnchor: [75, 14],
});

/** Sea name overlay: the raster tiles print "South China Sea" into the
 * image itself (cannot be edited), so we lay our own BIỂN ĐÔNG over the
 * middle of the sea. Non-interactive, sits under the island flags. */
const seaLabelIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:16px;font-weight:800;letter-spacing:.38em;color:#2E6DA8;text-shadow:0 0 6px #fff,0 0 6px #fff,0 0 10px #fff;white-space:nowrap">${SEA_LABEL.name}</div>`,
  iconSize: [230, 24], iconAnchor: [115, 12],
});

/** Famous-landmark pin: cute pink teardrop + name pill. */
const landmarkIcon = (name: string) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
    <svg width="24" height="30" viewBox="0 0 24 30"><path d="M12 0C6.5 0 2 4.5 2 10c0 7.5 10 18 10 18s10-10.5 10-18C22 4.5 17.5 0 12 0z" fill="#F472B6" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="4" fill="#fff"/></svg>
    <div style="background:rgba(255,255,255,.94);border:1.5px solid #F472B6;border-radius:999px;padding:1.5px 8px;font-size:10px;font-weight:800;color:#A12354;white-space:nowrap;box-shadow:0 2px 6px rgba(15,23,42,.22)">${name}</div>
  </div>`,
  iconSize: [130, 56], iconAnchor: [65, 29],
});

/**
 * Tile providers — all verified by downloading real tiles and VIEWING them
 * (2026-10-31). Lessons: tile.openstreetmap.org returns HTTP 418
 * "Access blocked" tiles for many clients (v1.0 black map), and CARTO
 * basemaps now serves "API KEY REQUIRED" watermark placeholders (v1.1).
 * Esri WorldStreetMap is a real Google-style street map (roads + Vietnamese
 * labels) on the ArcGIS CDN: free, no key, no watermark.
 * v1.27 (2026-11-02): OSM HOT promoted to PRIMARY street provider for the
 * cuter look (warm cream land, soft blue water, tiles downloaded and VIEWED
 * today — real map content, no watermark); Esri stays as the automatic
 * fallback when HOT fails to deliver tiles.
 */
const STREET_PROVIDERS = [
  { name: 'OSM HOT', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', subdomains: 'abc', attribution: '&copy; OpenStreetMap contributors' },
  { name: 'Esri Street', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', subdomains: undefined as string | undefined, attribution: 'Tiles &copy; Esri, OpenStreetMap contributors' },
];
const SATELLITE_PROVIDERS = [
  { name: 'Esri Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', subdomains: undefined as string | undefined, attribution: 'Tiles &copy; Esri World Imagery' },
];

function FollowUser({ lat, lng, enabled }: { lat: number | null; lng: number | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => { if (enabled && lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true }); }, [lat, lng, map, enabled]);
  return null;
}

function MapGrabber({ setMap }: { setMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { setMap(map); }, [map, setMap]);
  return null;
}

/** Setup-preview framing: when a route appears and we are NOT in
 * follow mode, zoom out so the whole suggestion (start → destination)
 * is visible at once, Google-Maps style. */
function RouteFitter({ route, followUser }: { route?: [number, number][] | null; followUser: boolean }) {
  const map = useMap();
  const keyRef = useRef('');
  useEffect(() => {
    if (!route || route.length < 2 || followUser) return;
    const key = `${route.length}|${route[0][0]},${route[0][1]}|${route[route.length - 1][0]},${route[route.length - 1][1]}`;
    if (keyRef.current === key) return;
    keyRef.current = key;
    map.fitBounds(L.latLngBounds(route.map(([la, ln]) => [la, ln] as [number, number])), { padding: [36, 36], maxZoom: 15, animate: true });
  }, [route, followUser, map]);
  return null;
}

interface Props {
  lat: number | null;
  lng: number | null;
  /** When the Mapbox engine failed mid-session, the wrapper hands over its
   * last view so the fallback opens in the same place. */
  initialView?: { center: [number, number]; zoom: number } | null;
  /** Predicted-route polyline ([lat, lng] pairs) to draw, if any. */
  route?: [number, number][] | null;
  /** Destination point to flag, if picked. */
  dest?: { lat: number; lng: number; name: string } | null;
  /** true: camera follows the user. false (setup preview): frame the
   * whole route instead. */
  followUser?: boolean;
  /** Approved danger communes to tint by their real boundary (v1.42). */
  zones?: CommuneZone[];
}

const destIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:2.5px solid #10B981;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(15,23,42,.35)">🏁</div>',
  iconSize: [30, 30], iconAnchor: [15, 15],
});

/** The original Leaflet/Esri map — kept intact as the fallback renderer. */
export default function LeafletMapView({ lat, lng, initialView, route, dest, followUser = true, zones = [] }: Props) {
  const center: [number, number] = initialView?.center ?? (lat !== null && lng !== null ? [lat, lng] : [14.0583, 108.2772]);
  const [mapInst, setMapInst] = useState<L.Map | null>(null);
  const [mode, setMode] = useState<'street' | 'satellite'>('street');
  const [providerIdx, setProviderIdx] = useState(0);
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [showNoTilesHint, setShowNoTilesHint] = useState(false);
  const errorsRef = useRef(0);
  const loadedRef = useRef(0);

  const providers = mode === 'street' ? STREET_PROVIDERS : SATELLITE_PROVIDERS;
  const provider = providers[Math.min(providerIdx, providers.length - 1)];

  const switchMode = (m: 'street' | 'satellite') => {
    setMode(m); setProviderIdx(0); errorsRef.current = 0; loadedRef.current = 0; setTilesLoaded(0); setShowNoTilesHint(false);
  };

  useEffect(() => {
    const t = window.setTimeout(() => { if (loadedRef.current === 0) setShowNoTilesHint(true); }, 8000);
    return () => clearTimeout(t);
  }, [providerIdx, mode]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/10 h-[340px] md:h-[440px] lg:h-[560px]">
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .leaflet-container{background:#EAF6FD}'}</style>
      <MapContainer center={center} zoom={initialView?.zoom ?? (lat ? 12 : 6)} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          key={`${mode}-${providerIdx}`}
          attribution={provider.attribution}
          url={provider.url}
          {...(provider.subdomains ? { subdomains: provider.subdomains } : {})}
          eventHandlers={{
            tileload: () => { loadedRef.current += 1; setTilesLoaded(loadedRef.current); setShowNoTilesHint(false); },
            tileerror: () => {
              errorsRef.current += 1;
              // Current provider is not delivering: fail over to the next one.
              if (loadedRef.current === 0 && errorsRef.current >= 5 && providerIdx < providers.length - 1) {
                errorsRef.current = 0;
                setProviderIdx(providerIdx + 1);
              }
            },
          }}
        />
        <FollowUser lat={lat} lng={lng} enabled={followUser} />
        <MapGrabber setMap={setMapInst} />
        <RouteFitter route={route} followUser={followUser} />
        {lat !== null && lng !== null && (
          <Marker position={[lat, lng]} icon={userIcon}><Popup>Vị trí của bạn</Popup></Marker>
        )}
        {route && route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: '#FFFFFF', weight: 9, opacity: 0.75 }} />
            <Polyline positions={route} pathOptions={{ color: '#0EA5E9', weight: 5, opacity: 0.95 }} />
          </>
        )}
        {dest && (
          <Marker position={[dest.lat, dest.lng]} icon={destIcon} zIndexOffset={900}>
            <Popup><b>🏁 Điểm đến</b><br />{dest.name}</Popup>
          </Marker>
        )}
        {BORDER_LINES.map((line) => (
          <Fragment key={line.id}>
            <Polyline positions={line.points} pathOptions={{ color: '#EF4444', weight: 16, opacity: 0.13 }} />
            <Polyline positions={line.points} pathOptions={{ color: '#EF4444', weight: 2.5, opacity: 0.95, dashArray: '7 6' }}>
              <Popup><b>{line.name}</b><br />Đường biên giới thật — đường mòn, lối mở có thể xuất hiện ở bất kỳ đoạn nào. App báo động khi bạn cách đường này dưới 10km.</Popup>
            </Polyline>
          </Fragment>
        ))}
        {BORDER_POINTS.map((b) => (
          <Fragment key={b.id}>
            <Circle center={[b.lat, b.lng]} radius={BORDER_RADIUS_KM * 1000} pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.10, weight: 1.5 }} />
            <Marker position={[b.lat, b.lng]} icon={borderIcon}>
              <Popup><b>{b.name}</b><br />{b.province} — biên giới {b.country}<br />{b.dangerNote}</Popup>
            </Marker>
          </Fragment>
        ))}
        {zones.map((z) => {
          const meta = ZONE_TYPE_META[z.topType];
          if (z.geometry) {
            return (
              <Polygon
                key={z.key}
                positions={geometryToLeaflet(z.geometry) as [number, number][][]}
                pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.16, weight: 2 }}
              >
                <Popup><ZonePopupContent zone={z} /></Popup>
              </Polygon>
            );
          }
          if (z.centroid) {
            return (
              <Circle
                key={z.key}
                center={[z.centroid.lat, z.centroid.lng]}
                radius={FALLBACK_RADIUS_M}
                pathOptions={{ color: meta.color, fillColor: meta.color, fillOpacity: 0.12, weight: 2, dashArray: '6 6' }}
              >
                <Popup><ZonePopupContent zone={z} /></Popup>
              </Circle>
            );
          }
          return null;
        })}
        <Marker position={[SEA_LABEL.lat, SEA_LABEL.lng]} icon={seaLabelIcon} interactive={false} zIndexOffset={400} />
        {LANDMARKS.map((g) => (
          <Marker key={g.id} position={[g.lat, g.lng]} icon={landmarkIcon(g.name)} zIndexOffset={800}>
            <Popup><b>{g.name}</b><br />Địa danh nổi tiếng của Việt Nam.</Popup>
          </Marker>
        ))}
        {ISLAND_GROUPS.map((g) => (
          <Marker key={g.id} position={[g.lat, g.lng]} icon={islandIcon(g.short, g.en)} zIndexOffset={1000}>
            <Popup><b>{g.name}</b> ({g.en})<br />Thuộc chủ quyền của Việt Nam — belongs to Vietnam.</Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-2 right-2 z-[500] flex rounded-xl overflow-hidden border border-slate-600 shadow-lg text-[11px] font-bold">
        <button onClick={() => switchMode('street')} className={`px-2.5 py-1.5 ${mode === 'street' ? 'bg-blue-600 text-white' : 'bg-black/30/90 text-slate-300'}`}>🗺️ Đường</button>
        <button onClick={() => switchMode('satellite')} className={`px-2.5 py-1.5 ${mode === 'satellite' ? 'bg-blue-600 text-white' : 'bg-black/30/90 text-slate-300'}`}>🛰️ Vệ tinh</button>
      </div>
      {route && route.length > 1 && (
        <button
          onClick={() => { if (mapInst) mapInst.fitBounds(L.latLngBounds(route.map(([la, ln]) => [la, ln] as [number, number])), { padding: [36, 36], maxZoom: 15, animate: true }); }}
          className="absolute top-11 right-2 z-[500] px-2.5 py-1.5 rounded-xl border border-slate-600 shadow-lg text-[11px] font-bold bg-black/30/90 text-slate-200"
        >
          🛣 Toàn tuyến
        </button>
      )}
      {tilesLoaded === 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[500] pointer-events-none">
          <p className={`text-center text-[11px] font-bold py-1.5 ${showNoTilesHint ? 'bg-red-600/90 text-white' : 'bg-black/30/85 text-slate-300'}`}>
            {showNoTilesHint ? `Không tải được nền bản đồ từ ${provider.name} — đang thử nguồn khác / kiểm tra kết nối mạng. Cờ đỏ và đường biên vẫn đúng vị trí.` : 'Đang tải nền bản đồ...'}
          </p>
        </div>
      )}
    </div>
  );
}

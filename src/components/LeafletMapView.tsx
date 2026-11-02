import { Fragment, useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BORDER_LINES, BORDER_POINTS, BORDER_RADIUS_KM } from '../utils/data';

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.35);animation:pulse 1.4s infinite"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const borderIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:20px;line-height:1">🚩</div>', iconSize: [20, 20], iconAnchor: [10, 10],
});

/**
 * Tile providers — all verified by downloading real tiles and VIEWING them
 * (2026-10-31). Lessons: tile.openstreetmap.org returns HTTP 418
 * "Access blocked" tiles for many clients (v1.0 black map), and CARTO
 * basemaps now serves "API KEY REQUIRED" watermark placeholders (v1.1).
 * Esri WorldStreetMap is a real Google-style street map (roads + Vietnamese
 * labels) on the ArcGIS CDN: free, no key, no watermark.
 */
const STREET_PROVIDERS = [
  { name: 'Esri Street', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', subdomains: undefined as string | undefined, attribution: 'Tiles &copy; Esri, OpenStreetMap contributors' },
  { name: 'OSM HOT', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', subdomains: 'abc', attribution: '&copy; OpenStreetMap contributors' },
];
const SATELLITE_PROVIDERS = [
  { name: 'Esri Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', subdomains: undefined as string | undefined, attribution: 'Tiles &copy; Esri World Imagery' },
];

function FollowUser({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => { if (lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true }); }, [lat, lng, map]);
  return null;
}

interface Props {
  lat: number | null;
  lng: number | null;
  /** When the Mapbox engine failed mid-session, the wrapper hands over its
   * last view so the fallback opens in the same place. */
  initialView?: { center: [number, number]; zoom: number } | null;
}

/** The original Leaflet/Esri map — kept intact as the fallback renderer. */
export default function LeafletMapView({ lat, lng, initialView }: Props) {
  const center: [number, number] = initialView?.center ?? (lat !== null && lng !== null ? [lat, lng] : [14.0583, 108.2772]);
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
    <div className="relative rounded-3xl overflow-hidden border border-slate-700 h-[340px] md:h-[440px] lg:h-[560px]">
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .leaflet-container{background:#0F172A}'}</style>
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
        <FollowUser lat={lat} lng={lng} />
        {lat !== null && lng !== null && (
          <Marker position={[lat, lng]} icon={userIcon}><Popup>Vị trí của bạn</Popup></Marker>
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
      </MapContainer>
      <div className="absolute top-2 right-2 z-[500] flex rounded-xl overflow-hidden border border-slate-600 shadow-lg text-[11px] font-bold">
        <button onClick={() => switchMode('street')} className={`px-2.5 py-1.5 ${mode === 'street' ? 'bg-blue-600 text-white' : 'bg-slate-900/90 text-slate-300'}`}>🗺️ Đường</button>
        <button onClick={() => switchMode('satellite')} className={`px-2.5 py-1.5 ${mode === 'satellite' ? 'bg-blue-600 text-white' : 'bg-slate-900/90 text-slate-300'}`}>🛰️ Vệ tinh</button>
      </div>
      {tilesLoaded === 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[500] pointer-events-none">
          <p className={`text-center text-[11px] font-bold py-1.5 ${showNoTilesHint ? 'bg-red-600/90 text-white' : 'bg-slate-900/85 text-slate-300'}`}>
            {showNoTilesHint ? `Không tải được nền bản đồ từ ${provider.name} — đang thử nguồn khác / kiểm tra kết nối mạng. Cờ đỏ và đường biên vẫn đúng vị trí.` : 'Đang tải nền bản đồ...'}
          </p>
        </div>
      )}
    </div>
  );
}

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
 * Tile providers in failover order. CARTO (Fastly CDN) first because
 * tile.openstreetmap.org is often slow/blocked on VN mobile carriers —
 * that was the "black map" bug: Leaflet loaded, tiles never arrived.
 */
const TILE_PROVIDERS = [
  { name: 'CARTO Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' },
  { name: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc', attribution: '&copy; OpenStreetMap' },
  { name: 'CARTO Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO' },
];

function FollowUser({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => { if (lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true }); }, [lat, lng, map]);
  return null;
}

interface Props { lat: number | null; lng: number | null }

export default function MapView({ lat, lng }: Props) {
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [14.0583, 108.2772];
  const [providerIdx, setProviderIdx] = useState(0);
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [showNoTilesHint, setShowNoTilesHint] = useState(false);
  const errorsRef = useRef(0);
  const loadedRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => { if (loadedRef.current === 0) setShowNoTilesHint(true); }, 8000);
    return () => clearTimeout(t);
  }, [providerIdx]);

  const provider = TILE_PROVIDERS[providerIdx];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-700" style={{ height: 340 }}>
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .leaflet-container{background:#0F172A}'}</style>
      <MapContainer center={center} zoom={lat ? 12 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          key={providerIdx}
          attribution={provider.attribution}
          url={provider.url}
          subdomains={provider.subdomains}
          eventHandlers={{
            tileload: () => { loadedRef.current += 1; setTilesLoaded(loadedRef.current); setShowNoTilesHint(false); },
            tileerror: () => {
              errorsRef.current += 1;
              // Current provider is not delivering: fail over to the next one.
              if (loadedRef.current === 0 && errorsRef.current >= 5 && providerIdx < TILE_PROVIDERS.length - 1) {
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

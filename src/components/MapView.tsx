import { useEffect } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BORDER_POINTS, BORDER_RADIUS_KM } from '../utils/data';

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 6px rgba(59,130,246,.35);animation:pulse 1.4s infinite"></div>',
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const borderIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:20px;line-height:1">🚩</div>', iconSize: [20, 20], iconAnchor: [10, 10],
});

function FollowUser({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => { if (lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true }); }, [lat, lng, map]);
  return null;
}

interface Props { lat: number | null; lng: number | null }

export default function MapView({ lat, lng }: Props) {
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : [14.0583, 108.2772];
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700" style={{ height: 340 }}>
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} .leaflet-container{background:#0F172A}'}</style>
      <MapContainer center={center} zoom={lat ? 12 : 6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FollowUser lat={lat} lng={lng} />
        {lat !== null && lng !== null && (
          <Marker position={[lat, lng]} icon={userIcon}><Popup>Vị trí của bạn</Popup></Marker>
        )}
        {BORDER_POINTS.map((b) => (
          <span key={b.id}>
            <Circle center={[b.lat, b.lng]} radius={BORDER_RADIUS_KM * 1000} pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.14, weight: 1.5 }} />
            <Marker position={[b.lat, b.lng]} icon={borderIcon}>
              <Popup><b>{b.name}</b><br />{b.province} — biên giới {b.country}<br />{b.dangerNote}</Popup>
            </Marker>
          </span>
        ))}
      </MapContainer>
    </div>
  );
}

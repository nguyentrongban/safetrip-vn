import { useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import { ArrowLeft, Gauge, RefreshCw } from 'lucide-react';
import { fetchPosition, type LiveConfig, type LiveRow } from '../utils/live';
import MapboxLiveMap from './MapboxLiveMap';
import { useMapEngine, type SavedView } from '../hooks/useMapEngine';

function Follow({ row }: { row: LiveRow | null }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!row) return;
    if (first.current) { map.setView([row.lat, row.lng], 14); first.current = false; }
    else map.panTo([row.lat, row.lng], { animate: true });
  }, [row, map]);
  return null;
}

/** The original Leaflet live map — kept intact as the fallback renderer. */
function LeafletLiveMap({ row, trail, initialView }: { row: LiveRow | null; trail: [number, number][]; initialView?: SavedView | null }) {
  return (
    <MapContainer center={initialView?.center ?? [14.0583, 108.2772]} zoom={initialView?.zoom ?? 6} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" subdomains="abc" />
      <Follow row={row} />
      {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#3B82F6', weight: 4, opacity: 0.8 }} />}
      {row && <CircleMarker center={[row.lat, row.lng]} radius={14} pathOptions={{ color: '#fff', weight: 3, fillColor: '#EF4444', fillOpacity: 1 }} />}
    </MapContainer>
  );
}

/** Engine-choice wrapper: Mapbox GL primary, automatic silent Leaflet fallback. */
function LiveMapFrame({ row, trail }: { row: LiveRow | null; trail: [number, number][] }) {
  const { engine, savedView, fail } = useMapEngine();
  if (engine === 'mapbox') {
    return <MapboxLiveMap row={row} trail={trail} initialView={savedView} onFail={fail} />;
  }
  return <LeafletLiveMap row={row} trail={trail} initialView={savedView} />;
}

interface Props { code: string; cfg: LiveConfig; onClose: () => void }

/** Family-side live viewer: polls the sender's position every 10s, dot glides on the map with a trail — Grab-style. */
export default function LiveView({ code, cfg, onClose }: Props) {
  const [row, setRow] = useState<LiveRow | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [notFound, setNotFound] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await fetchPosition(cfg, code);
      if (!alive) return;
      if (r) {
        setRow(r); setNotFound(false);
        setTrail((t) => {
          const last = t[t.length - 1];
          if (last && last[0] === r.lat && last[1] === r.lng) return t;
          return [...t.slice(-199), [r.lat, r.lng]];
        });
      } else setNotFound(true);
      setTick((x) => x + 1);
    };
    void load();
    const id = window.setInterval(() => { void load(); }, 10000);
    return () => { alive = false; clearInterval(id); };
  }, [cfg, code]);

  const ageSec = row ? Math.max(0, Math.round((Date.now() - new Date(row.updated_at).getTime()) / 1000)) : null;
  const stale = ageSec !== null && ageSec > 120;

  return (
    <div className="space-y-3">
      <style>{'@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}70%{box-shadow:0 0 0 16px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}} .leaflet-container{background:#0F172A}'}</style>
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="bg-slate-800 text-white p-2.5 rounded-xl" aria-label="Quay lại"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-white text-lg leading-none">Đang theo dõi trực tiếp</h2>
          <p className="text-xs text-slate-400 mt-1">Mã: <b className="text-white tracking-widest">{code}</b></p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${row && !row.active ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : row && stale ? 'bg-red-600/25 text-red-300 border-red-500' : row ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
          {row && !row.active ? 'ĐÃ KẾT THÚC' : row && stale ? '⚠️ DỪNG ĐỘT NGỘT' : row ? '● TRỰC TIẾP' : 'Đang chờ tín hiệu'}
        </span>
      </div>

      <div className="rounded-3xl overflow-hidden border border-slate-700 h-[52dvh] min-h-[320px]">
        <LiveMapFrame row={row} trail={trail} />
      </div>

      <div className="bg-panel rounded-3xl p-4 border border-slate-700/60">
        {notFound && !row && <p className="text-base text-amber-300 font-bold">Chưa thấy tín hiệu của mã này. Người thân chưa bắt đầu đi, hoặc sai mã.</p>}
        {row && (
          <div className="space-y-1.5">
            <p className="text-base text-white flex items-center gap-2"><RefreshCw className="w-4 h-4 text-sky-400" /> Cập nhật: <b>{ageSec !== null ? (ageSec < 5 ? 'vừa xong' : `${ageSec} giây trước`) : '—'}</b></p>
            <p className="text-base text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-emerald-400" /> Tốc độ xe: <b>{row.speed !== null ? `${Math.round(row.speed)} km/h` : '—'}</b></p>
            {stale && row.active && (
              <div className="bg-red-600/15 border-2 border-red-500 rounded-2xl p-3.5 space-y-1.5">
                <p className="text-lg text-red-400 font-black leading-snug">⚠️ THEO DÕI DỪNG ĐỘT NGỘT</p>
                <p className="text-sm text-red-200">Người gửi <b>không bấm dừng</b> mà tín hiệu tự mất lúc {new Date(row.updated_at).toLocaleTimeString('vi-VN')}. Có thể máy hết pin, mất sóng — <b>hoặc đã bị phát hiện và bị bắt dừng theo dõi</b>.</p>
                <p className="text-sm text-white font-bold">Hãy gọi cho người gửi ngay. Không liên lạc được thì gọi công an:</p>
                <a href="tel:113" className="inline-block bg-red-600 text-white font-black px-5 py-2.5 rounded-xl text-base">📞 GỌI 113</a>
              </div>
            )}
            {!row.active && <p className="text-base text-emerald-300 font-bold">✅ Chuyến đi đã kết thúc — người gửi đã tự bấm dừng.</p>}
            <a href={`https://www.google.com/maps?q=${row.lat},${row.lng}`} target="_blank" rel="noreferrer" className="inline-block mt-1 bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm">Mở bằng Google Maps</a>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-2">Trang tự làm mới mỗi 10 giây. Chấm đỏ di chuyển = người thân đang di chuyển.</p>
      </div>
    </div>
  );
}

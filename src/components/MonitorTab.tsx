import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, ShieldCheck, Square, TriangleAlert } from 'lucide-react';
import MapView from './MapView';
import type { GeoState } from '../hooks/useGeolocation';
import { formatCountdown, useDeadMansSwitch } from '../hooks/useDeadMansSwitch';
import { BORDER_LINES, BORDER_LINE_ALERT_KM, BORDER_POINTS, BORDER_RADIUS_KM, PROVINCES } from '../utils/data';
import { distanceToBorderLine, formatKm, nearestBorder } from '../utils/geo';
import { loadTrip, saveTrip } from '../utils/storage';
import type { TripConfig } from '../types';

interface Props {
  geo: GeoState & { startWatch: () => void; stopWatch: () => void };
  onBorderAlarm: (borderName: string) => void;
  onDeadManTimeout: () => void;
  alarming: boolean;
}

export default function MonitorTab({ geo, onBorderAlarm, onDeadManTimeout, alarming }: Props) {
  const [destination, setDestination] = useState(PROVINCES[0]);
  const [hours, setHours] = useState(5);
  const [trip, setTrip] = useState<TripConfig | null>(() => loadTrip());
  const [borderAlertedFor, setBorderAlertedFor] = useState<string | null>(null);

  const nearest = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return null;
    return nearestBorder({ lat: geo.lat, lng: geo.lng }, BORDER_POINTS);
  }, [geo.lat, geo.lng]);

  const nearestLine = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return null;
    return distanceToBorderLine({ lat: geo.lat, lng: geo.lng }, BORDER_LINES);
  }, [geo.lat, geo.lng]);

  const nearGate = !!trip && nearest !== null && nearest.distanceKm < BORDER_RADIUS_KM;
  const nearLine = !!trip && nearestLine !== null && nearestLine.distanceKm < BORDER_LINE_ALERT_KM;
  const nearBorder = nearGate || nearLine;
  const dangerKey = nearLine && nearestLine ? `line:${nearestLine.lineId}` : nearGate && nearest ? `gate:${nearest.border.id}` : null;

  useEffect(() => {
    if (nearBorder && dangerKey && borderAlertedFor !== dangerKey) {
      setBorderAlertedFor(dangerKey);
      if (dangerKey.startsWith('line:') && nearestLine) {
        onBorderAlarm(`Cách ĐƯỜNG BIÊN GIỚI (${nearestLine.lineName}) chỉ ${formatKm(nearestLine.distanceKm)} — vùng có đường mòn/lối mở qua biên giới`);
      } else if (nearest) {
        onBorderAlarm(nearest.border.name);
      }
    }
    if (!nearBorder) setBorderAlertedFor(null);
  }, [nearBorder, dangerKey, nearest, nearestLine, borderAlertedFor, onBorderAlarm]);

  const dms = useDeadMansSwitch(!!trip, onDeadManTimeout);

  const start = () => {
    const t: TripConfig = { destination, hours, startedAt: Date.now() };
    setTrip(t); saveTrip(t); geo.startWatch();
  };
  const stop = () => { setTrip(null); saveTrip(null); geo.stopWatch(); };

  return (
    <div className="space-y-4">
      <MapView lat={geo.lat} lng={geo.lng} />

      {nearest && nearestLine && (
        <div className={`rounded-2xl p-3 border text-sm space-y-1 ${nearBorder ? 'bg-red-500/15 border-red-500 text-red-100' : 'bg-panel border-slate-700/60 text-slate-200'}`}>
          {nearBorder ? <TriangleAlert className="inline w-4 h-4 mr-1 -mt-0.5" /> : null}
          <span>Cửa khẩu gần nhất: <b>{nearest.border.name}</b> ({nearest.border.province}) — cách <b>{formatKm(nearest.distanceKm)}</b></span>
          <span className="block">Đường biên giới gần nhất: <b>{nearestLine.lineName}</b> — cách <b>{formatKm(nearestLine.distanceKm)}</b></span>
          {nearLine && <span className="block font-bold">⚠️ BẠN ĐANG Ở SÁT ĐƯỜNG BIÊN GIỚI — khu vực này có thể có đường mòn, đường rừng, lối mở tự phát qua biên giới dù không có cửa khẩu!</span>}
          {nearGate && !nearLine && <span className="block font-bold">BẠN ĐANG TRONG VÙNG 15KM QUANH CỬA KHẨU!</span>}
        </div>
      )}

      {!trip ? (
        <section className="bg-panel rounded-2xl p-4 border border-slate-700/60 space-y-3">
          <h3 className="font-bold text-white">Bắt đầu chuyến đi</h3>
          <label className="block text-xs text-slate-400">Nơi đến
            <select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white">
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">Số giờ dự kiến: <b className="text-white">{hours} giờ</b>
            <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-blue-500 mt-2" />
          </label>
          <button onClick={start} className="w-full bg-success hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Play className="w-4 h-4" /> BẮT ĐẦU GIÁM SÁT
          </button>
          <p className="text-[11px] text-slate-500">Khi bật: app theo dõi GPS liên tục, tự báo động nếu cách cửa khẩu dưới 15km HOẶC cách đường biên giới (kể cả đoạn không có cửa khẩu, có đường mòn/lối mở) dưới 10km, và bật Dead Man's Switch check-in mỗi 30 phút.</p>
        </section>
      ) : (
        <section className="bg-panel rounded-2xl p-4 border border-emerald-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Đang đi tới: {trip.destination}</h3>
            <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full font-bold">● ĐANG GIÁM SÁT</span>
          </div>

          <div className={`rounded-xl p-3 text-center border ${dms.inGrace ? 'bg-red-500/15 border-red-500' : 'bg-slate-900 border-slate-700'}`}>
            <p className="text-[11px] text-slate-400">{dms.inGrace ? '⚠️ HẾT GIỜ CHECK-IN! BẤM "TÔI AN TOÀN" NGAY' : "DEAD MAN'S SWITCH — CHECK-IN SAU"}</p>
            <p className={`text-3xl font-black tabular-nums ${dms.inGrace ? 'text-red-400' : 'text-white'}`}>{formatCountdown(dms.inGrace ? dms.graceLeft : dms.secondsLeft)}</p>
            {dms.inGrace && <p className="text-[11px] text-red-300 mt-1">Hết thời gian chờ, app sẽ TỰ GỬI SOS cho người thân!</p>}
            <motion.button whileTap={{ scale: 0.97 }} onClick={dms.checkIn} className="mt-2 w-full bg-success text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" /> TÔI AN TOÀN
            </motion.button>
          </div>

          <button onClick={stop} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
            <Square className="w-4 h-4" /> Kết thúc chuyến đi
          </button>
          {alarming && <p className="text-center text-red-400 text-xs font-bold animate-blink-red">ĐANG PHÁT BÁO ĐỘNG — sang tab Home để tắt còi</p>}
        </section>
      )}
    </div>
  );
}

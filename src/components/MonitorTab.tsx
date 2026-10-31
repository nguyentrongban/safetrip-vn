import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Play, ShieldCheck, Square, TriangleAlert } from 'lucide-react';
import MapView from './MapView';
import LivePanel from './LivePanel';
import LiveUpdateBanner from './LiveUpdateBanner';
import type { GeoState } from '../hooks/useGeolocation';
import { formatCountdown, useDeadMansSwitch } from '../hooks/useDeadMansSwitch';
import { useLiveSmsUpdates } from '../hooks/useLiveSmsUpdates';
import { BORDER_LINES, BORDER_LINE_ALERT_KM, BORDER_POINTS, BORDER_RADIUS_KM, PROVINCES } from '../utils/data';
import { distanceToBorderLine, formatKm, nearestBorder } from '../utils/geo';
import { loadTrip, saveTrip } from '../utils/storage';
import type { TripConfig } from '../types';

interface Props {
  geo: GeoState & { startWatch: () => void; stopWatch: () => void };
  onBorderAlarm: (borderName: string) => void;
  onDeadManTimeout: () => void;
  onOpenLive: (code: string) => void;
  alarming: boolean;
}

export default function MonitorTab({ geo, onBorderAlarm, onDeadManTimeout, onOpenLive, alarming }: Props) {
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
  const live = useLiveSmsUpdates(!!trip && !alarming, geo.lat, geo.lng);

  const start = () => {
    const t: TripConfig = { destination, hours, startedAt: Date.now() };
    setTrip(t); saveTrip(t); geo.startWatch();
  };
  const stop = () => { setTrip(null); saveTrip(null); geo.stopWatch(); };

  return (
    <>
    <LiveUpdateBanner visible={!!live.prompt} onSend={live.sendUpdate} onDismiss={live.dismiss} />
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
      <div className="space-y-3 min-w-0">
        <MapView lat={geo.lat} lng={geo.lng} />
        {nearest && nearestLine && (
          <div className={`grid grid-cols-2 gap-2 ${nearBorder ? '' : ''}`}>
            <div className={`rounded-3xl p-3.5 border text-center ${nearLine ? 'bg-red-500/15 border-red-500' : 'bg-panel border-slate-700/60'}`}>
              <p className="text-xs text-slate-400 font-bold">🚩 TỚI BIÊN GIỚI</p>
              <p className={`text-2xl font-black ${nearLine ? 'text-red-400' : 'text-white'}`}>{formatKm(nearestLine.distanceKm)}</p>
            </div>
            <div className={`rounded-3xl p-3.5 border text-center ${nearGate ? 'bg-red-500/15 border-red-500' : 'bg-panel border-slate-700/60'}`}>
              <p className="text-xs text-slate-400 font-bold">🏁 TỚI CỬA KHẨU GẦN NHẤT</p>
              <p className={`text-2xl font-black ${nearGate ? 'text-red-400' : 'text-white'}`}>{formatKm(nearest.distanceKm)}</p>
              <p className="text-[11px] text-slate-400 truncate">{nearest.border.name}</p>
            </div>
          </div>
        )}
        {nearBorder && (
          <div className="bg-red-600 text-white rounded-3xl p-3.5 font-black text-center text-base">
            <TriangleAlert className="inline w-5 h-5 mr-1 -mt-1" />
            {nearLine ? 'QUÁ GẦN BIÊN GIỚI — HÃY CẢNH GIÁC!' : 'ĐANG Ở GẦN CỬA KHẨU BIÊN GIỚI!'}
          </div>
        )}
      </div>

      <div>
        {!trip ? (
          <section className="bg-panel rounded-3xl p-4 border border-slate-700/60 space-y-4">
            <h3 className="font-black text-white text-lg">Bạn đi đâu?</h3>
            <select value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-base text-white">
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div>
              <p className="text-sm text-slate-300 mb-1">Đi khoảng <b className="text-white text-base">{hours} giờ</b></p>
              <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-blue-500" />
            </div>
            <button onClick={start} className="w-full bg-success hover:bg-emerald-600 text-white text-lg font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
              <Play className="w-6 h-6" /> BẮT ĐẦU ĐI
            </button>
            <p className="text-xs text-slate-400 text-center">App tự canh: gần biên giới là báo ngay.</p>
          </section>
        ) : (
          <section className="bg-panel rounded-3xl p-4 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-white text-base flex items-center gap-1.5 min-w-0"><Flag className="w-5 h-5 text-emerald-400 shrink-0" /><span className="truncate">Đang đi: {trip.destination}</span></h3>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full font-bold shrink-0">● ĐANG CANH</span>
            </div>

            <div className={`rounded-3xl p-4 text-center border ${dms.inGrace ? 'bg-red-500/15 border-red-500' : 'bg-slate-900 border-slate-700'}`}>
              <p className="text-sm font-bold text-slate-300">{dms.inGrace ? '⚠️ BẤM NGAY NÚT XANH Ở DƯỚI!' : 'Còn từng này phải điểm danh:'}</p>
              <p className={`text-4xl font-black tabular-nums my-1 ${dms.inGrace ? 'text-red-400' : 'text-white'}`}>{formatCountdown(dms.inGrace ? dms.graceLeft : dms.secondsLeft)}</p>
              {dms.inGrace && <p className="text-xs text-red-300 font-bold">Không bấm = còi kêu to + mở sẵn tin SOS</p>}
              <motion.button whileTap={{ scale: 0.97 }} onClick={dms.checkIn} className="mt-2 w-full bg-success text-white text-lg font-black py-3.5 rounded-2xl flex items-center justify-center gap-2">
                <ShieldCheck className="w-6 h-6" /> TÔI AN TOÀN
              </motion.button>
            </div>

            <button onClick={stop} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Đã tới nơi — tắt canh
            </button>
            {alarming && <p className="text-center text-red-400 text-sm font-bold animate-blink-red">ĐANG KÊU CÒI — sang tab SOS để tắt</p>}
          </section>
        )}
        <div className="mt-4">
          <LivePanel onOpenLive={onOpenLive} />
        </div>
      </div>
    </div>
    </>
  );
}

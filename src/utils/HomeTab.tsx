import { useEffect, useState } from 'react';
import { Gauge, MapPin, Navigation, Save, UserRound } from 'lucide-react';
import SOSButton from './SOSButton';
import type { GeoState } from '../hooks/useGeolocation';
import { reverseGeocode } from '../utils/geo';
import { loadSOS, saveSOS } from '../utils/storage';
import type { SOSConfig } from '../types';

interface Props {
  geo: GeoState;
  alarming: boolean;
  onSOS: () => void;
  onStopAlarm: () => void;
}

export default function HomeTab({ geo, alarming, onSOS, onStopAlarm }: Props) {
  const [cfg, setCfg] = useState<SOSConfig>(() => loadSOS());
  const [saved, setSaved] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (geo.lat === null || geo.lng === null) return;
    let alive = true;
    reverseGeocode(geo.lat, geo.lng).then((a) => { if (alive && a) setAddress(a); });
    return () => { alive = false; };
  }, [geo.lat, geo.lng]);

  const save = () => { saveSOS(cfg); setSaved(true); window.setTimeout(() => setSaved(false), 2000); };
  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center pt-2 pb-1">
        <SOSButton onTrigger={onSOS} alarming={alarming} onStop={onStopAlarm} />
        <p className="text-slate-400 text-xs mt-3 text-center px-6">Giữ nút 2 giây: bật còi, mở sẵn SMS gửi vị trí Google Maps cho người thân số 1.</p>
        {!cfg.phone1 && <p className="text-amber-400 text-xs mt-1 font-semibold">⚠️ Bạn chưa lưu SĐT người thân ở form bên dưới!</p>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-panel rounded-2xl p-3 border border-slate-700/60">
          <MapPin className="w-4 h-4 text-blue-400 mb-1" />
          <p className="text-[10px] text-slate-400">VĨ ĐỘ</p>
          <p className="text-xs font-bold text-white truncate">{geo.lat !== null ? geo.lat.toFixed(5) : '—'}</p>
        </div>
        <div className="bg-panel rounded-2xl p-3 border border-slate-700/60">
          <Navigation className="w-4 h-4 text-blue-400 mb-1" />
          <p className="text-[10px] text-slate-400">KINH ĐỘ</p>
          <p className="text-xs font-bold text-white truncate">{geo.lng !== null ? geo.lng.toFixed(5) : '—'}</p>
        </div>
        <div className="bg-panel rounded-2xl p-3 border border-slate-700/60">
          <Gauge className="w-4 h-4 text-emerald-400 mb-1" />
          <p className="text-[10px] text-slate-400">TỐC ĐỘ</p>
          <p className="text-xs font-bold text-white">{geo.speedKmh !== null ? `${geo.speedKmh} km/h` : '0 km/h'}</p>
        </div>
      </div>
      {address && <p className="text-xs text-slate-300 bg-panel border border-slate-700/60 rounded-xl px-3 py-2">📍 {address}</p>}
      {geo.status === 'denied' && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 text-xs text-red-200">
          <b>Chưa cấp quyền vị trí.</b> Hãy bật GPS: Cài đặt điện thoại → Vị trí → Bật, rồi vào Cài đặt trình duyệt → Quyền → Vị trí → Cho phép cho trang này, sau đó tải lại trang.
        </div>
      )}

      <section className="bg-panel rounded-2xl p-4 border border-slate-700/60 space-y-3">
        <h3 className="font-bold text-white flex items-center gap-2"><UserRound className="w-4 h-4 text-blue-400" /> Người thân nhận SOS</h3>
        <input className={inputCls} inputMode="tel" placeholder="SĐT người thân 1 (nhận SMS SOS)" value={cfg.phone1} onChange={(e) => setCfg({ ...cfg, phone1: e.target.value })} />
        <input className={inputCls} inputMode="tel" placeholder="SĐT người thân 2 (dự phòng)" value={cfg.phone2} onChange={(e) => setCfg({ ...cfg, phone2: e.target.value })} />
        <textarea className={inputCls} rows={3} placeholder="Tin nhắn SOS mẫu" value={cfg.message} onChange={(e) => setCfg({ ...cfg, message: e.target.value })} />
        <button onClick={save} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
          <Save className="w-4 h-4" /> {saved ? 'ĐÃ LƯU ✓' : 'Lưu cấu hình'}
        </button>
        <p className="text-[11px] text-slate-500">Lưu ngay trên máy này (LocalStorage), không gửi lên server, mất mạng vẫn dùng được.</p>
      </section>
    </div>
  );
}

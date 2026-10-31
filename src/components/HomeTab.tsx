import { useEffect, useState } from 'react';
import { Gauge, MapPin, Phone, Save } from 'lucide-react';
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
  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center pt-3">
        <SOSButton onTrigger={onSOS} alarming={alarming} onStop={onStopAlarm} />
        {!cfg.phone1 && <p className="text-amber-400 text-sm mt-3 font-bold">⚠️ Chưa có số người thân — điền ở dưới</p>}
      </div>

      <div className="bg-panel rounded-3xl p-4 border border-slate-700/60 space-y-2">
        <p className="text-base text-white flex items-start gap-2">
          <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <span>{address ? <>{address}</> : geo.lat !== null ? <>{geo.lat.toFixed(5)}, {geo.lng?.toFixed(5)}</> : 'Chưa biết vị trí — hãy bật định vị'}</span>
        </p>
        <p className="text-sm text-slate-300 flex items-center gap-2 pl-7">
          <Gauge className="w-4 h-4 text-emerald-400" /> Xe đang chạy: <b className="text-white">{geo.speedKmh !== null ? `${geo.speedKmh} km/h` : '0 km/h'}</b>
        </p>
      </div>

      <section className="bg-panel rounded-3xl p-4 border border-slate-700/60 space-y-3">
        <h3 className="font-black text-white text-base flex items-center gap-2"><Phone className="w-5 h-5 text-blue-400" /> Người thân nhận tin SOS</h3>
        <input className={inputCls} inputMode="tel" placeholder="Số điện thoại người thân 1" value={cfg.phone1} onChange={(e) => setCfg({ ...cfg, phone1: e.target.value })} />
        <input className={inputCls} inputMode="tel" placeholder="Số người thân 2 (nếu có)" value={cfg.phone2} onChange={(e) => setCfg({ ...cfg, phone2: e.target.value })} />
        <textarea className={inputCls} rows={2} placeholder="Lời nhắn khi bấm SOS" value={cfg.message} onChange={(e) => setCfg({ ...cfg, message: e.target.value })} />
        <button onClick={save} className="w-full bg-primary hover:bg-blue-600 text-white text-base font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
          <Save className="w-5 h-5" /> {saved ? 'ĐÃ LƯU ✓' : 'LƯU LẠI'}
        </button>
      </section>
    </div>
  );
}

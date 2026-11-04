import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, MessageSquareText, Phone, Save } from 'lucide-react';
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
  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition-colors';
  const iconInputCls = 'w-full bg-black/30 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition-colors';
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.32, ease: 'easeOut' as const },
  });

  return (
    <div className="space-y-4">
      <motion.div {...fadeUp(0)} className="flex flex-col items-center pt-3">
        <SOSButton onTrigger={onSOS} alarming={alarming} onStop={onStopAlarm} />
        {!cfg.phone1 && (
          <p className="mt-4 flex items-center gap-2 bg-amber-400/10 border border-amber-400/40 text-amber-300 text-xs font-bold px-3 py-2 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Chưa có số người thân — điền ở dưới
          </p>
        )}
      </motion.div>

      <motion.div {...fadeUp(0.08)} className="grid grid-cols-[1fr_auto] gap-2 items-stretch">
        <div className="bg-panel rounded-3xl p-4 border border-white/10 flex items-start gap-2 min-w-0">
          <MapPin className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-sm text-white leading-snug">{address ? address : geo.lat !== null ? `${geo.lat.toFixed(5)}, ${geo.lng?.toFixed(5)}` : 'Chưa biết vị trí — hãy bật định vị'}</p>
        </div>
        <div className="bg-panel rounded-3xl px-4 py-3 border border-white/10 flex flex-col items-center justify-center min-w-[92px]">
          <p className="text-[26px] font-black text-white leading-none">{geo.speedKmh !== null ? geo.speedKmh : 0}<span className="text-[11px] font-bold text-slate-400"> km/h</span></p>
          <p className="text-[9px] text-slate-500 font-bold mt-1.5 tracking-[0.18em]">TỐC ĐỘ XE</p>
        </div>
      </motion.div>

      <motion.section {...fadeUp(0.16)} className="bg-panel rounded-3xl p-4 border border-white/10 space-y-3">
        <h3 className="font-black text-white text-base flex items-center gap-2"><Phone className="w-5 h-5 text-sky-400" /> Người thân nhận SOS</h3>
        <div className="relative">
          <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className={iconInputCls} inputMode="tel" placeholder="Số điện thoại người thân 1" value={cfg.phone1} onChange={(e) => setCfg({ ...cfg, phone1: e.target.value })} />
        </div>
        <div className="relative">
          <Phone className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className={iconInputCls} inputMode="tel" placeholder="Số người thân 2 (nếu có)" value={cfg.phone2} onChange={(e) => setCfg({ ...cfg, phone2: e.target.value })} />
        </div>
        <div className="relative">
          <MessageSquareText className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-500" />
          <textarea className={iconInputCls} rows={2} placeholder="Lời nhắn khi bấm SOS" value={cfg.message} onChange={(e) => setCfg({ ...cfg, message: e.target.value })} />
        </div>
        <motion.button whileTap={{ scale: 0.98 }} onClick={save} className="w-full bg-white hover:bg-slate-200 text-slate-900 text-base font-black py-3.5 rounded-full flex items-center justify-center gap-2 transition-colors">
          <Save className="w-5 h-5" /> {saved ? 'ĐÃ LƯU ✓' : 'LƯU LẠI'}
        </motion.button>
      </motion.section>
    </div>
  );
}

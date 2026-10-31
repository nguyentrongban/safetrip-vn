import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, House, MapPin, Satellite, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import HomeTab from './components/HomeTab';
import MonitorTab from './components/MonitorTab';
import SearchTab from './components/SearchTab';
import HandbookTab from './components/HandbookTab';
import { useGeolocation } from './hooks/useGeolocation';
import { useAlarm } from './hooks/useAlarm';
import type { TabId } from './types';

const TABS: { id: TabId; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'SOS', Icon: House },
  { id: 'monitor', label: 'Giám Sát', Icon: MapPin },
  { id: 'search', label: 'Tra Cứu', Icon: Search },
  { id: 'handbook', label: 'Sổ Tay', Icon: BookOpen },
];

export default function App() {
  const [tab, setTab] = useState<TabId>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const geo = useGeolocation();
  const alarm = useAlarm();

  const onSOS = useCallback(() => {
    alarm.triggerSOS('Người dùng giữ nút SOS', geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  const onBorderAlarm = useCallback((borderName: string) => {
    alarm.triggerSOS(`Áp sát biên giới: ${borderName}`, geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  const onDeadManTimeout = useCallback(() => {
    alarm.triggerSOS("Dead Man's Switch: quá 3 phút không check-in", geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    const done = () => setInstalled(true);
    window.addEventListener('appinstalled', done);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', done); };
  }, []);

  const installApp = async () => {
    const ev = deferredPrompt as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null;
    if (!ev) return;
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === 'accepted') setDeferredPrompt(null);
  };

  const gpsOk = geo.status === 'granted';

  return (
    <div className={`min-h-dvh bg-base text-slate-100 ${alarm.alarming ? 'bg-red-950' : ''}`}>
      {alarm.alarming && <div className="fixed inset-0 pointer-events-none z-40 border-8 border-red-500 animate-blink-red" />}
      <header className="sticky top-0 z-30 bg-[#0F172A]/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-white" /></div>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-white leading-none">SafeTrip VN</h1>
            <p className="text-[11px] text-slate-400 truncate">An toàn xe khách · Cảnh báo biên giới</p>
          </div>
          <button onClick={geo.requestOnce} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border ${gpsOk ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-red-500/15 text-red-300 border-red-500/40'}`}>
            <Satellite className="w-3.5 h-3.5" /> {gpsOk ? 'GPS: Đang định vị' : geo.status === 'locating' ? 'GPS: Đang tìm...' : 'GPS: Chưa bật'}
          </button>
        </div>
        {!installed && deferredPrompt && (
          <div className="max-w-md mx-auto mt-2">
            <button onClick={installApp} className="w-full bg-primary text-white text-sm font-bold py-2 rounded-xl">📲 Ghim SafeTrip VN ra màn hình chính</button>
          </div>
        )}
        {!installed && !deferredPrompt && (
          <p className="max-w-md mx-auto text-[11px] text-slate-500 mt-2">Để ghim ra màn hình chính: Android Chrome → menu ⋮ → "Cài đặt ứng dụng". iPhone Safari → Chia sẻ → "Thêm vào Màn hình chính".</p>
        )}
      </header>

      {alarm.alarming && (
        <div className="max-w-md mx-auto px-4 pt-3">
          <div className="bg-red-600 text-white rounded-2xl p-3 font-bold text-sm flex gap-2 items-start">
            <TriangleAlert className="w-5 h-5 shrink-0" />
            <span>ĐANG BÁO ĐỘNG: {alarm.lastTrigger}. Còi đang phát, SMS SOS đã được mở sẵn cho người thân. Bấm nút đỏ ở tab SOS để tắt.</span>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 pt-4 pb-28">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {tab === 'home' && <HomeTab geo={geo} alarming={alarm.alarming} onSOS={onSOS} onStopAlarm={alarm.stopAlarm} />}
            {tab === 'monitor' && <MonitorTab geo={geo} onBorderAlarm={onBorderAlarm} onDeadManTimeout={onDeadManTimeout} alarming={alarm.alarming} />}
            {tab === 'search' && <SearchTab />}
            {tab === 'handbook' && <HandbookTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0B1220]/95 backdrop-blur border-t border-slate-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-md mx-auto grid grid-cols-4 relative">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`relative py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-bold ${tab === id ? 'text-blue-400' : 'text-slate-400'}`}>
              <Icon className="w-5 h-5" /> {label}
              {id === 'home' && alarm.alarming && <span className="absolute top-1 right-4 w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, House, MapPin, Satellite, Search, TriangleAlert } from 'lucide-react';
import HomeTab from './components/HomeTab';
import MonitorTab from './components/MonitorTab';
import SearchTab from './components/SearchTab';
import HandbookTab from './components/HandbookTab';
import ConsentSheet from './components/ConsentSheet';
import { PrivacyContent, TermsContent } from './components/LegalPages';
import ContactForm from './components/ContactForm';
import { CONSENT_EVENT, clearConsent, getConsent, hasLocationConsent, saveConsent, type ConsentRecord } from './utils/consent';
import LiveUpdateBanner from './components/LiveUpdateBanner';
import LiveView from './components/LiveView';
import { useGeolocation } from './hooks/useGeolocation';
import { useAlarm } from './hooks/useAlarm';
import { useLiveSmsUpdates } from './hooks/useLiveSmsUpdates';
import { useLiveTracking } from './hooks/useLiveTracking';
import { decodeConfigParam, ensureLiveSession, loadLiveConfig, type LiveConfig } from './utils/live';
import { loadTrip } from './utils/storage';
import { APP_VERSION } from './version';
import type { TabId } from './types';

const TABS: { id: TabId; label: string; Icon: typeof House }[] = [
  { id: 'home', label: 'SOS', Icon: House },
  { id: 'monitor', label: 'Giám Sát', Icon: MapPin },
  { id: 'search', label: 'Tra Cứu', Icon: Search },
  { id: 'handbook', label: 'Sổ Tay', Icon: BookOpen },
];

const SHELL = 'max-w-md md:max-w-2xl lg:max-w-4xl mx-auto';

export default function App() {
  const [tab, setTab] = useState<TabId>(() => {
    // Deep link from the DMS push notification (push-sw.js opens
    // /?tab=monitor): land straight on the check-in tab.
    const wanted = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((x) => x.id === wanted) ? (wanted as TabId) : 'home';
  });
  const [legal, setLegal] = useState<'privacy' | 'terms' | 'contact' | null>(null);
  const [consentRec, setConsentRec] = useState<ConsentRecord | null>(() => getConsent());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const [booted, setBooted] = useState(false);
  const [liveViewCode, setLiveViewCode] = useState<string | null>(() => new URLSearchParams(window.location.search).get('live'));
  const [liveCfg, setLiveCfg] = useState<LiveConfig | null>(() => {
    // A ?live= link's station (&c=) is used for THIS viewing session only and
    // is never saved (v1.17): the default is always the shared station, and
    // only a station the user deliberately saves in the panel overrides it.
    const fromLink = decodeConfigParam(new URLSearchParams(window.location.search).get('c') || '');
    if (fromLink) return fromLink;
    return loadLiveConfig();
  });
  const [tripActive, setTripActive] = useState<boolean>(() => !!loadTrip());
  const geo = useGeolocation();
  const alarm = useAlarm();
  const live = useLiveSmsUpdates(alarm.alarming, geo.lat, geo.lng);
  useLiveTracking(alarm.alarming || tripActive, liveCfg, geo.lat, geo.lng, geo.speedKmh);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTripActive(!!loadTrip());
      setLiveCfg((prev) => prev || loadLiveConfig());
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // The ?tab= deep link is consumed once at startup (initial tab above);
  // drop it from the address bar so a later manual reload opens normally.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('tab')) {
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, []);

  // The push service worker asks the open app to jump to a tab when a
  // notification is tapped (see public/push-sw.js) — no reload needed.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; tab?: string } | null;
      if (d?.type === 'SAFETRIP_OPEN_TAB' && TABS.some((x) => x.id === d.tab)) {
        setTab(d.tab as TabId);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  const closeLive = useCallback(() => {
    setLiveViewCode(null);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Coming back from the browser/OS settings (where the user re-allowed
  // location) re-checks automatically, so the gate closes by itself.
  const geoRequestOnce = geo.requestOnce;
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && geo.lat === null && hasLocationConsent()) geoRequestOnce(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [geoRequestOnce, geo.lat]);

  const gpsOk = geo.status === 'granted';

  const geoStopWatch = geo.stopWatch;
  const agreeConsent = useCallback(() => {
    setConsentRec(saveConsent('granted'));
    setSheetOpen(false);
    geoRequestOnce();
  }, [geoRequestOnce]);
  const laterConsent = useCallback(() => {
    setConsentRec(saveConsent('later'));
    setSheetOpen(false);
  }, []);
  const withdrawConsent = useCallback(() => {
    clearConsent();
    setConsentRec(null);
    geoStopWatch();
  }, [geoStopWatch]);

  // A feature asked for GPS without consent on file -> open the sheet.
  useEffect(() => {
    const onAsk = () => { if (!liveViewCode) setSheetOpen(true); };
    window.addEventListener(CONSENT_EVENT, onAsk);
    return () => window.removeEventListener(CONSENT_EVENT, onAsk);
  }, [liveViewCode]);

  // Location consent (v1.58, Nghị định 13/2023): the app's own consent
  // sheet comes first; the browser's permission dialog only appears
  // after the user agrees there. Returning users with consent on file
  // are asked once by the browser as before. The live-view page (family
  // watching) never asks: the viewer needs no location.
  const bootedRef = useState({ done: false })[0];
  useEffect(() => {
    if (bootedRef.done) return;
    bootedRef.done = true;
    if (!liveViewCode) {
      if (hasLocationConsent()) geoRequestOnce();
      else if (!getConsent()) setSheetOpen(true);
    }
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSOS = useCallback(() => {
    ensureLiveSession();
    alarm.triggerSOS('Người dùng giữ nút SOS', geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  const onBorderAlarm = useCallback((borderName: string) => {
    ensureLiveSession();
    alarm.triggerSOS(`Áp sát biên giới: ${borderName}`, geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  const onDeadManTimeout = useCallback(() => {
    ensureLiveSession();
    alarm.triggerSOS("Dead Man's Switch: quá 3 phút không check-in", geo.lat, geo.lng);
  }, [alarm, geo.lat, geo.lng]);

  useEffect(() => {
    document.body.style.overflow = legal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [legal]);

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

  return (
    <div className={`min-h-dvh bg-base text-slate-100 ${alarm.alarming ? 'bg-red-950' : ''}`}>
      {alarm.alarming && <div className="fixed inset-0 pointer-events-none z-40 border-8 border-red-500 animate-blink-red" />}

      <header className="sticky top-0 z-30 bg-[#07080A]/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className={`${SHELL} flex items-center gap-3`}>
          <img src="/logo-shield.png" alt="SafeTrip VN" className="h-10 w-10 object-contain block shrink-0" />
          <h1 className="flex-1 font-bold tracking-tight text-white text-lg leading-none">SafeTrip VN</h1>
          <button onClick={() => { if (!gpsOk) geo.requestOnce(); }} className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border ${gpsOk ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-red-500/15 text-red-300 border-red-500/40'}`}>
            <Satellite className="w-4 h-4" /> {gpsOk ? 'Định vị: Đang bật' : geo.status === 'error' ? 'Định vị: Chưa có tín hiệu' : geo.status === 'locating' ? 'Định vị: Đang tìm…' : 'Định vị: Đang tắt'}
          </button>
        </div>
        {!installed && deferredPrompt && (
          <div className={`${SHELL} mt-2`}>
            <button onClick={installApp} className="w-full bg-white text-slate-900 text-sm font-bold py-2.5 rounded-full">📲 Ghim app ra màn hình chính</button>
          </div>
        )}
      </header>

      {booted && !gpsOk && !liveViewCode && geo.status !== 'locating' && (
        <button onClick={geo.requestOnce} className="block w-full bg-amber-500 text-slate-900 font-bold text-sm py-2.5 px-4 text-center">
          {geo.status === 'denied'
            ? '⚠️ Định vị đang bị chặn — bấm để thử lại, hoặc mở lại quyền trong Cài đặt của trình duyệt'
            : geo.status === 'error'
              ? '⚠️ Chưa bắt được tín hiệu GPS — bấm để thử lại'
              : geo.status === 'unsupported'
                ? '⚠️ Máy này không hỗ trợ định vị'
                : '⚠️ Định vị đang tắt — app không bảo vệ được bạn. Bấm đây để bật'}
        </button>
      )}

      {alarm.alarming && (
        <div className={`${SHELL} px-4 pt-3`}>
          <div className="bg-red-600 text-white rounded-2xl p-3 font-bold text-sm flex gap-2 items-center">
            <TriangleAlert className="w-6 h-6 shrink-0" />
            <span>ĐANG BÁO ĐỘNG — {alarm.lastTrigger}. Đã mở sẵn tin nhắn gửi người thân.</span>
          </div>
        </div>
      )}

      <main className={`${SHELL} px-4 pt-4 pb-28`}>
        {liveViewCode ? (
          liveCfg ? (
            <LiveView code={liveViewCode.toUpperCase()} cfg={liveCfg} onClose={closeLive} />
          ) : (
            <div className="bg-panel rounded-3xl p-5 border border-white/10 text-center space-y-3">
              <p className="text-white font-black text-lg">Link này thiếu dữ liệu nối</p>
              <p className="text-sm text-slate-300">Hãy mở đúng link trong tin nhắn SOS, hoặc vào tab Giám Sát, panel "Theo dõi trực tiếp" để nhập mã.</p>
              <button onClick={closeLive} className="bg-primary text-white font-bold px-5 py-3 rounded-2xl">Quay lại app</button>
            </div>
          )
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {tab === 'home' && <HomeTab geo={geo} alarming={alarm.alarming} onSOS={onSOS} onStopAlarm={alarm.stopAlarm} />}
              {tab === 'monitor' && <MonitorTab geo={geo} onBorderAlarm={onBorderAlarm} onDeadManTimeout={onDeadManTimeout} onOpenLive={(c) => setLiveViewCode(c)} alarming={alarm.alarming} />}
              {tab === 'search' && <SearchTab />}
              {tab === 'handbook' && <HandbookTab consentRec={consentRec} onOpenLegal={(p) => setLegal(p)} onAgreeConsent={agreeConsent} onWithdrawConsent={withdrawConsent} />}
            </motion.div>
          </AnimatePresence>
        )}
        {!liveViewCode && (
          <footer className="mt-10 text-center space-y-2">
            <p className="flex items-center justify-center gap-2 text-xs font-semibold">
              <button onClick={() => setLegal('privacy')} className="text-slate-400 underline underline-offset-2">Chính sách bảo mật</button>
              <span className="text-slate-600">•</span>
              <button onClick={() => setLegal('terms')} className="text-slate-400 underline underline-offset-2">Điều khoản sử dụng</button>
              <span className="text-slate-600">•</span>
              <button onClick={() => setLegal('contact')} className="text-slate-400 underline underline-offset-2">Liên hệ hỗ trợ</button>
            </p>
            <p className="text-xs text-slate-500 font-semibold">SafeTrip VN • Phiên bản {APP_VERSION}</p>
            <p className="text-[11px] text-slate-600">© 2026 SafeTrip VN. Mọi quyền được bảo lưu.</p>
            <p className="text-[10px] leading-4 text-slate-600 px-6">Nghiêm cấm sao chép giao diện, mã nguồn và cạo dữ liệu khi chưa được đồng ý bằng văn bản.</p>
          </footer>
        )}
      </main>

      {legal && (
        <div className="fixed inset-0 z-50 bg-base overflow-y-auto">
          <header className="sticky top-0 z-10 bg-[#07080A]/90 backdrop-blur border-b border-white/10 px-4 py-3">
            <div className={`${SHELL} flex items-center gap-3`}>
              <button onClick={() => setLegal(null)} aria-label="Quay lại" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white shrink-0"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="font-bold tracking-tight text-white text-lg">{legal === 'privacy' ? 'Chính sách bảo mật' : legal === 'terms' ? 'Điều khoản sử dụng' : 'Liên hệ hỗ trợ'}</h2>
            </div>
          </header>
          <div className={`${SHELL} px-4 py-5 pb-16`}>
            {legal === 'privacy' ? <PrivacyContent /> : legal === 'terms' ? <TermsContent /> : <ContactForm />}
          </div>
        </div>
      )}

      <ConsentSheet open={sheetOpen} onAgree={agreeConsent} onLater={laterConsent} onOpenPrivacy={() => setLegal('privacy')} />

      <LiveUpdateBanner visible={!!live.prompt} onSend={live.sendUpdate} onDismiss={live.dismiss} />

      {!liveViewCode && (
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#07080A]/90 backdrop-blur border-t border-white/10" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className={`${SHELL} grid grid-cols-4`}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`relative py-2.5 flex flex-col items-center gap-0.5 text-xs font-bold ${tab === id ? 'text-white' : 'text-slate-500'}`}>
              {tab === id && <motion.span layoutId="tabGlow" className="absolute top-0 h-1 w-10 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <Icon className="w-6 h-6" /> {label}
              {id === 'home' && alarm.alarming && <span className="absolute top-1 right-4 w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </button>
          ))}
        </div>
      </nav>
      )}
    </div>
  );
}

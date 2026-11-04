import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellPlus, BellRing, ChevronDown, CircleCheck, Share } from 'lucide-react';
import { currentSubscription, iosNeedsInstall, isPushConfigured, isPushSupported, isStandaloneApp, refreshPushRegistration, subscribePush, unsubscribePush } from '../utils/push';

type CardState = 'checking' | 'ios-install' | 'unsupported' | 'denied' | 'off' | 'busy' | 'on';

/** Fresh permission read that TS flow-narrowing cannot freeze at its
 *  pre-dialog value (the dialog itself changes it during an await). */
function readPermission(): NotificationPermission {
  return Notification.permission;
}

/**
 * "Thông báo điểm danh" card (v1.34) — sits next to the Dead Man's Switch
 * controls in Giám Sát. The push Worker (Cloudflare, since v1.36) watches
 * the check-in deadline server-side and Web-Pushes a warning ~5 minutes
 * before it; this card is where the traveler arms that warning on their
 * own phone. iOS only delivers Web Push to home-screen-installed web
 * apps, hence the install-first state.
 */
export default function PushNotifyCard() {
  const configured = isPushConfigured();
  const [state, setState] = useState<CardState>('checking');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const standalone = isStandaloneApp();

  const evaluate = useCallback(async () => {
    if (iosNeedsInstall()) { setState('ios-install'); return; }
    if (!isPushSupported()) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    const sub = await currentSubscription();
    if (Notification.permission === 'granted' && sub) {
      // The session code rotates after each trip — keep the Worker's filing
      // of this subscription pointed at the current code (no-op if fresh).
      void refreshPushRegistration();
      setState('on');
    } else {
      setState('off');
    }
  }, []);

  // v1.40 — entering Giám Sát asks right away: the tap on the tab is the
  // user gesture iOS requires for the permission dialog, so fire the ask
  // IMMEDIATELY on mount, before any slower subscription bookkeeping.
  // Once answered (Cho phép / Không cho phép) the permission is no longer
  // 'default' and this never auto-asks again; if the dialog silently
  // didn't show (gesture window missed), evaluate() leaves the big
  // "Bật thông báo" button as the fallback.
  const init = useCallback(async () => {
    if (!configured || iosNeedsInstall() || !isPushSupported()) { void evaluate(); return; }
    if (Notification.permission === 'default') {
      setState('busy');
      const r = await subscribePush();
      if (r === 'subscribed') { setState('on'); return; }
      if (r === 'unsupported') { setState('unsupported'); return; }
      if (r === 'denied' && readPermission() === 'denied') { setState('denied'); return; }
    } else if (Notification.permission === 'granted' && !(await currentSubscription())) {
      // Permission already given but the subscription is gone (browser
      // housekeeping): re-subscribe silently — no dialog involved.
      const r = await subscribePush();
      if (r === 'subscribed') { setState('on'); return; }
    }
    void evaluate();
  }, [configured, evaluate]);

  useEffect(() => { void init(); }, [init]);

  // Permission can be changed in browser settings while the app is open,
  // and the session code rotates — re-check on the same slow heartbeat
  // style as LivePanel instead of demanding a page reload.
  useEffect(() => {
    const id = window.setInterval(() => { void evaluate(); }, 5000);
    return () => window.clearInterval(id);
  }, [evaluate]);

  const enable = async () => {
    setState('busy'); setNote('');
    const r = await subscribePush();
    if (r === 'subscribed') { setState('on'); return; }
    if (r === 'denied') { setState('denied'); return; }
    if (r === 'no-relay') { setNote('Trạm đang tạm tắt nên chưa bật được thông báo.'); setState('off'); return; }
    if (r === 'unsupported') { setState('unsupported'); return; }
    setNote('Chưa bật được — kiểm tra mạng rồi bấm thử lại.');
    setState('off');
  };

  const disable = async () => {
    setState('busy');
    await unsubscribePush();
    setState('off');
  };

  /* v1.48 — minimal by context (tấn's order): push ON collapses to one
   * slim row everywhere; in a browser TAB the whole card is one slim
   * row with a "!" badge — tap to expand the how-to — because the big
   * guidance box was pure clutter there; the installed app keeps the
   * full card. */
  if (configured && state === 'on') {
    return (
      <section className="bg-panel rounded-3xl px-4 py-3 border border-white/10 flex items-center gap-2">
        <CircleCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="flex-1 text-sm font-bold text-emerald-300">Nhắc điểm danh: đã bật</p>
        <button onClick={() => void disable()} className="text-xs text-slate-500 font-bold underline underline-offset-2 shrink-0">Tắt</button>
      </section>
    );
  }

  if (!standalone) {
    return (
      <section className="bg-panel rounded-3xl border border-white/10 overflow-hidden">
        <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 flex items-center gap-2.5 text-left">
          <span className="relative shrink-0">
            <BellRing className="w-5 h-5 text-sky-400" />
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 text-[9px] font-black flex items-center justify-center">!</span>
          </span>
          <span className="flex-1 font-black text-white text-base">Nhắc điểm danh</span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="px-4 pb-4">
            {!configured ? (
              <p className="text-sm text-amber-300 font-semibold">Trạm đang tạm tắt — chưa bật được thông báo.</p>
            ) : state === 'ios-install' ? (
              <div className="bg-black/30 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <p className="text-sm text-white font-bold flex items-start gap-2">
                  <Share className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                  Cần ghim app vào màn hình chính mới có thông báo:
                </p>
                <ol className="text-sm text-slate-300 list-decimal list-inside space-y-1 pl-1">
                  <li>Bấm <b className="text-white">Chia sẻ</b> ở thanh trình duyệt.</li>
                  <li>Chọn <b className="text-white">“Thêm vào màn hình chính”</b>.</li>
                  <li>Mở app từ <b className="text-white">icon ngoài màn hình chính</b>.</li>
                </ol>
              </div>
            ) : state === 'denied' ? (
              <p className="text-sm text-amber-300 font-semibold flex items-start gap-2">
                <BellOff className="w-5 h-5 shrink-0 mt-0.5" />
                Thông báo đang bị tắt trong Cài đặt máy — bật lại cho SafeTrip VN rồi quay lại đây.
              </p>
            ) : state === 'unsupported' ? (
              <p className="text-sm text-amber-300 font-semibold">Trình duyệt này chưa hỗ trợ thông báo đẩy.</p>
            ) : state === 'checking' || state === 'busy' ? (
              <p className="text-sm text-slate-400 font-bold">{state === 'busy' ? 'Đang bật…' : 'Đang kiểm tra…'}</p>
            ) : (
              <div className="space-y-2">
                <button onClick={() => void enable()} className="w-full bg-emerald-500 text-white text-lg font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
                  <BellPlus className="w-6 h-6" /> Bật thông báo
                </button>
                {note && <p className="text-sm text-amber-300 font-semibold text-center">{note}</p>}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="bg-panel rounded-3xl p-4 border border-white/10 space-y-3">
      <h3 className="font-black text-white text-lg flex items-center gap-2">
        <BellRing className="w-5 h-5 text-sky-400" /> Nhắc điểm danh
      </h3>

      {!configured ? (
        <p className="text-sm text-amber-300 font-semibold">Trạm đang tạm tắt — chưa bật được thông báo.</p>
      ) : state === 'checking' || state === 'busy' ? (
        <p className="text-sm text-slate-400 font-bold">{state === 'busy' ? 'Đang bật…' : 'Đang kiểm tra…'}</p>
      ) : state === 'unsupported' ? (
        <p className="text-sm text-amber-300 font-semibold">Máy này chưa hỗ trợ thông báo đẩy.</p>
      ) : state === 'denied' ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-300 font-semibold flex items-start gap-2">
            <BellOff className="w-5 h-5 shrink-0 mt-0.5" />
            Thông báo đang bị tắt trong Cài đặt máy — bật lại cho SafeTrip VN rồi quay lại đây.
          </p>
          <button onClick={() => void evaluate()} className="w-full bg-white/10 border border-slate-600 text-white font-bold py-3 rounded-2xl">
            Tôi đã bật lại — kiểm tra lại
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => void enable()} className="w-full bg-emerald-500 text-white text-xl font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <BellPlus className="w-6 h-6" /> Bật thông báo
          </button>
          {note && <p className="text-sm text-amber-300 font-semibold text-center">{note}</p>}
        </div>
      )}
    </section>
  );
}

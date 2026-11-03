import { useCallback, useEffect, useState } from 'react';
import { BellOff, BellPlus, BellRing, CircleCheck, Share } from 'lucide-react';
import { currentSubscription, iosNeedsInstall, isPushConfigured, isPushSupported, refreshPushRegistration, subscribePush, unsubscribePush } from '../utils/push';

type CardState = 'checking' | 'ios-install' | 'unsupported' | 'denied' | 'off' | 'busy' | 'on';

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

  useEffect(() => { void evaluate(); }, [evaluate]);

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

  return (
    <section className="bg-panel rounded-3xl p-4 border border-slate-700/60 space-y-3">
      <h3 className="font-black text-white text-lg flex items-center gap-2">
        <BellRing className="w-5 h-5 text-sky-400" /> Thông báo điểm danh
      </h3>
      <p className="text-sm text-slate-300">
        Thoát web giữa chuyến đi cũng không sao: trạm sẽ gửi thông báo nhắc
        <b className="text-white"> trước giờ điểm danh 5 phút</b>, nổi ngay trên
        màn hình khóa. Bấm vào thông báo là vào điểm danh ngay.
      </p>

      {!configured ? (
        <p className="text-sm text-amber-300 font-semibold">Trạm trung chuyển đang tạm tắt — thông báo điểm danh chưa bật được. Điểm danh trong app vẫn chạy như cũ.</p>
      ) : state === 'checking' || state === 'busy' ? (
        <p className="text-sm text-slate-400 font-bold">{state === 'busy' ? 'Đang bật…' : 'Đang kiểm tra…'}</p>
      ) : state === 'ios-install' ? (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 space-y-2">
          <p className="text-sm text-white font-bold flex items-start gap-2">
            <Share className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            Trên iPhone, phải gắn app ra màn hình chính trước mới nhận được thông báo này:
          </p>
          <ol className="text-sm text-slate-300 list-decimal list-inside space-y-1 pl-1">
            <li>Bấm nút <b className="text-white">Chia sẻ</b> ở thanh trình duyệt.</li>
            <li>Chọn <b className="text-white">“Thêm vào màn hình chính”</b>.</li>
            <li>Mở SafeTrip từ <b className="text-white">icon ngoài màn hình chính</b>, quay lại đây và bật thông báo.</li>
          </ol>
        </div>
      ) : state === 'unsupported' ? (
        <p className="text-sm text-amber-300 font-semibold">Trình duyệt này chưa hỗ trợ thông báo đẩy. Hãy mở SafeTrip bằng Chrome (Android) hoặc gắn ra màn hình chính (iPhone) rồi quay lại đây.</p>
      ) : state === 'denied' ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-300 font-semibold flex items-start gap-2">
            <BellOff className="w-5 h-5 shrink-0 mt-0.5" />
            Thông báo đang bị tắt. Muốn bật lại: mở Cài đặt của máy → Thông báo → SafeTrip VN → bật “Cho phép thông báo”, rồi quay lại đây.
          </p>
          <button onClick={() => void evaluate()} className="w-full bg-slate-800 border border-slate-600 text-white font-bold py-3 rounded-2xl">
            Tôi đã bật lại — kiểm tra lại
          </button>
        </div>
      ) : state === 'on' ? (
        <div className="space-y-2">
          <p className="text-base text-emerald-300 font-black flex items-center gap-2">
            <CircleCheck className="w-6 h-6 shrink-0" /> Đã bật ✓ — trạm sẽ nhắc bạn trước giờ điểm danh 5 phút.
          </p>
          <button onClick={() => void disable()} className="text-xs text-slate-500 font-bold underline underline-offset-2">
            Tắt thông báo này
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => void enable()} className="w-full bg-primary text-white text-lg font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <BellPlus className="w-6 h-6" /> Bật thông báo nhắc điểm danh
          </button>
          {note && <p className="text-sm text-amber-300 font-semibold text-center">{note}</p>}
        </div>
      )}
    </section>
  );
}

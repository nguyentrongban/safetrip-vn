import { motion } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';

interface Props {
  denied: boolean;
  onEnable: () => void;
  onLater: () => void;
}

/**
 * Shown on EVERY app open while location is off (dismissing only hides it
 * for this session — it asks again next launch, as requested).
 * One icon, two short lines, one huge button. Steps appear only when the
 * browser has hard-denied permission and the user must flip it in settings.
 */
export default function LocationGate({ denied, onEnable, onLater }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-[#0F172A]/97 flex items-center justify-center p-5">
      <div className="w-full max-w-sm text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-blue-600/15 border-2 border-blue-500/50 flex items-center justify-center">
          <Navigation className="w-11 h-11 text-blue-400" />
        </div>
        <h2 className="text-2xl font-black text-white mt-5 leading-snug">Bật định vị<br />để app bảo vệ bạn</h2>
        <p className="text-slate-300 mt-2 text-base">App cần biết bạn đang ở đâu<br />để báo khi xe đi gần biên giới.</p>

        <button onClick={onEnable} className="mt-6 w-full bg-emerald-500 hover:bg-emerald-400 text-white text-lg font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[0_8px_30px_rgba(16,185,129,0.35)]">
          <MapPin className="w-6 h-6" /> BẬT ĐỊNH VỊ
        </button>

        {denied && (
          <div className="mt-5 bg-slate-800/80 border border-slate-700 rounded-2xl p-4 text-left space-y-2.5">
            <p className="text-sm font-bold text-white">Máy đang chặn định vị. Mở lại như sau:</p>
            {[
              'Bấm nút BẬT ĐỊNH VỊ ở trên',
              'Hiện bảng hỏi → chọn "Cho phép"',
              'Nếu không hiện bảng: vào Cài đặt của máy → quyền Vị trí của trình duyệt → Cho phép',
            ].map((s, i) => (
              <p key={i} className="text-sm text-slate-200 flex gap-2.5">
                <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center mt-0.5">{i + 1}</span>{s}
              </p>
            ))}
          </div>
        )}

        <button onClick={onLater} className="mt-5 text-slate-400 text-sm font-semibold inline-flex items-center gap-1 px-3 py-2">
          <X className="w-4 h-4" /> Để sau (lần mở app tới app sẽ hỏi lại)
        </button>
      </div>
    </motion.div>
  );
}

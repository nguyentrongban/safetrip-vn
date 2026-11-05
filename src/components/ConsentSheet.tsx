import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, ShieldCheck, Users } from 'lucide-react';

interface Props {
  open: boolean;
  onAgree: () => void;
  onLater: () => void;
  onOpenPrivacy: () => void;
}

const ROWS = [
  { Icon: MapPin, text: 'Để hiện vị trí của bạn trên bản đồ và cảnh báo khi bạn đến gần biên giới, cửa khẩu.' },
  { Icon: Users, text: 'Chỉ khi bạn bật chia sẻ chuyến đi, vị trí mới được gửi cho người thân có mã của bạn. Dữ liệu tự xóa sau tối đa 3 ngày.' },
  { Icon: ShieldCheck, text: 'Số điện thoại người thân bạn lưu chỉ nằm trong máy bạn — không gửi đi đâu hết.' },
];

/** One-time location consent sheet (Nghị định 13/2023): shown before the
 *  app ever asks the browser for GPS. Not pre-ticked, dismissible, and
 *  the rest of the app keeps working without location. */
export default function ConsentSheet({ open, onAgree, onLater, onOpenPrivacy }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="bg-panel border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
          >
            <div className="text-center">
              <img src="/logo-shield.png" alt="SafeTrip VN" className="h-14 w-14 object-contain mx-auto" />
              <h2 className="text-white font-black text-lg tracking-tight pt-2">SafeTrip cần dùng vị trí của bạn</h2>
            </div>
            <div className="space-y-3">
              {ROWS.map(({ Icon, text }) => (
                <p key={text} className="flex gap-3 text-sm text-slate-200 leading-5">
                  <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-sky-300" /></span>
                  <span className="pt-1">{text}</span>
                </p>
              ))}
            </div>
            <button onClick={onOpenPrivacy} className="block mx-auto text-xs font-semibold text-sky-400 underline underline-offset-2">Xem Chính sách bảo mật</button>
            <div className="space-y-2">
              <button onClick={onAgree} className="w-full bg-white text-slate-900 font-black py-3.5 rounded-full active:scale-[0.98] transition">Tôi đồng ý — bật định vị</button>
              <button onClick={onLater} className="w-full bg-white/10 text-slate-200 font-bold py-3 rounded-full active:scale-[0.98] transition">Để sau</button>
            </div>
            <p className="text-[11px] text-slate-500 text-center leading-4">Không đồng ý vẫn dùng được Tra Cứu và Sổ Tay. Bạn đổi ý bất cứ lúc nào trong mục Sổ Tay → Quyền riêng tư.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

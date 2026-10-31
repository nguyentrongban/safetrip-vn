import { MapPin, X } from 'lucide-react';

interface Props {
  visible: boolean;
  onSend: () => void;
  onDismiss: () => void;
}

/** Sticky one-tap banner: the vehicle moved — offer a fresh location SMS. */
export default function LiveUpdateBanner({ visible, onSend, onDismiss }: Props) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-24 z-40 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto">
      <div className="bg-amber-500 text-slate-900 rounded-3xl p-3.5 shadow-2xl flex items-center gap-3">
        <MapPin className="w-8 h-8 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-base leading-tight">Xe đã đi chỗ khác rồi!</p>
          <p className="text-sm font-semibold">Gửi lại vị trí mới cho người thân</p>
        </div>
        <button onClick={onSend} className="bg-slate-900 text-white font-black px-4 py-3 rounded-2xl text-sm shrink-0 active:scale-95 transition">GỬI NGAY</button>
        <button onClick={onDismiss} aria-label="Để sau" className="shrink-0 p-1 text-slate-700"><X className="w-5 h-5" /></button>
      </div>
    </div>
  );
}

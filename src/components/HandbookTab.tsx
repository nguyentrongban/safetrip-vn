import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Baby, ChevronDown, HeartPulse, Siren } from 'lucide-react';
import { GUIDE_ARTICLES } from '../utils/data';

const HOTLINES = [
  { number: '113', label: 'Công An', desc: 'Bắt cóc, khống chế, tội phạm', color: 'bg-blue-600', Icon: Siren },
  { number: '111', label: 'Cục Trẻ Em / Con Người', desc: 'Mua bán người, trẻ em gặp nguy hiểm', color: 'bg-amber-500', Icon: Baby },
  { number: '115', label: 'Cấp Cứu', desc: 'Y tế khẩn cấp', color: 'bg-red-600', Icon: HeartPulse },
];

export default function HandbookTab() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {HOTLINES.map(({ number, label, desc, color, Icon }) => (
          <a key={number} href={`tel:${number}`} className={`${color} rounded-2xl p-3 text-white active:scale-95 transition block`}>
            <Icon className="w-5 h-5 mb-1" />
            <p className="text-2xl font-black leading-none">{number}</p>
            <p className="text-[11px] font-bold mt-1">{label}</p>
            <p className="text-[10px] opacity-80 leading-tight mt-0.5">{desc}</p>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 text-center">Bấm vào số để gọi ngay, không cần bấm thêm.</p>

      <div className="space-y-2">
        {GUIDE_ARTICLES.map((a) => {
          const isOpen = open === a.id;
          return (
            <div key={a.id} className="bg-panel border border-slate-700/60 rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : a.id)} className="w-full flex items-center gap-3 p-4 text-left">
                <span className="text-2xl">{a.icon}</span>
                <span className="flex-1 font-bold text-white text-sm">{a.title}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <ul className="px-4 pb-4 space-y-2">
                      {a.body.map((line, i) => (
                        <li key={i} className="text-sm text-slate-200 flex gap-2"><span className="text-sky-400 font-black shrink-0">{i + 1}.</span>{line}</li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="bg-sky-500/10 border border-sky-500/40 rounded-2xl p-4 text-sm text-sky-100">
        <b>Mật mã an toàn với gia đình:</b> thống nhất trước một câu bình thường, ví dụ <i>"cho con gửi lời hỏi thăm bà"</i> — khi bạn nói câu này trong cuộc gọi, người thân hiểu ngay là bạn đang bị khống chế và sẽ gọi 113 kèm vị trí cuối cùng của bạn.
      </div>
    </div>
  );
}

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Baby, ChevronDown, HeartPulse, KeyRound, Siren } from 'lucide-react';
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
        {HOTLINES.map(({ number, label, desc, color, Icon }, i) => (
          <motion.a
            key={number}
            href={`tel:${number}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: 'easeOut' }}
            whileTap={{ scale: 0.94 }}
            className={`${color} rounded-3xl p-3.5 text-white block shadow-lg`}
          >
            <Icon className="w-5 h-5 mb-1.5" />
            <p className="text-[26px] font-black leading-none">{number}</p>
            <p className="text-[11px] font-bold mt-1.5">{label}</p>
            <p className="text-[10px] opacity-80 leading-tight mt-0.5">{desc}</p>
          </motion.a>
        ))}
      </div>

      <div className="space-y-2">
        {GUIDE_ARTICLES.map((a) => {
          const isOpen = open === a.id;
          return (
            <div key={a.id} className="bg-panel border border-white/10 rounded-2xl overflow-hidden">
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

      <div className="bg-panel border border-white/10 rounded-3xl p-4 text-sm text-slate-200 flex gap-3">
        <KeyRound className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <p><b className="text-white">Mật mã an toàn:</b> thống nhất với gia đình một câu bình thường, ví dụ <i>"cho con gửi lời hỏi thăm bà"</i> — nói câu này trong cuộc gọi là người thân hiểu bạn đang bị khống chế, sẽ gọi 113 kèm vị trí của bạn.</p>
      </div>
    </div>
  );
}

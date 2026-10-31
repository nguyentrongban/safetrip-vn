import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props { onTrigger: () => void; alarming: boolean; onStop: () => void }
const HOLD_MS = 2000;

/** Big round SOS button: must be HELD for 2 seconds to trigger (anti accidental tap). */
export default function SOSButton({ onTrigger, alarming, onStop }: Props) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const cancel = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; setProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (alarming) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) { setProgress(0); onTrigger(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [alarming, onTrigger]);

  useEffect(() => () => cancel(), [cancel]);

  if (alarming) {
    return (
      <button onClick={onStop} className="w-40 h-40 rounded-full bg-red-600 border-4 border-red-300 text-white font-black text-xl animate-blink-red shadow-[0_0_50px_rgba(239,68,68,0.8)] active:scale-95 transition">
        DỪNG<br />BÁO ĐỘNG
      </button>
    );
  }
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onPointerDown={startHold} onPointerUp={cancel} onPointerLeave={cancel} onContextMenu={(e) => e.preventDefault()}
      className="relative w-40 h-40 rounded-full bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-300/70 text-white animate-sos-pulse select-none touch-none"
      aria-label="Giữ 2 giây để phát SOS"
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
        <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${progress * 289} 289`} />
      </svg>
      <span className="block text-4xl font-black tracking-wider">SOS</span>
      <span className="block text-[11px] mt-1 px-4 leading-tight opacity-90">{progress > 0 ? `Đang giữ... ${Math.ceil((1 - progress) * 2)}s` : 'GIỮ 2 GIÂY ĐỂ PHÁT TÍN HIỆU'}</span>
    </motion.button>
  );
}

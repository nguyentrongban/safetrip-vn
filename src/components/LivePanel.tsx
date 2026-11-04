import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Eye, Link2, Radio, Save, Trash2 } from 'lucide-react';
import { ensureLiveSession, liveLink, loadLiveConfig, loadLiveSessionCode, loadOwnLiveConfig, saveLiveConfig } from '../utils/live';

interface Props { onOpenLive: (code: string) => void }

/**
 * Grab-style live tracking panel — community mode:
 * the shared relay is baked into the app, so users see their code + watch box
 * immediately with ZERO setup. Pasting your own relay (advanced) stays
 * available collapsed at the bottom and overrides the shared one.
 */
export default function LivePanel({ onOpenLive }: Props) {
  const [cfg, setCfg] = useState(() => loadLiveConfig());
  const [own, setOwn] = useState(() => loadOwnLiveConfig());
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [myCode, setMyCode] = useState<string | null>(() => loadLiveSessionCode());
  const [watchCode, setWatchCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedCfg, setSavedCfg] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMyCode(loadLiveSessionCode());
      setCfg(loadLiveConfig());
      setOwn(loadOwnLiveConfig());
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { if (cfg) ensureLiveSession(); }, [cfg]);

  const save = () => {
    if (!url.trim() || !key.trim()) return;
    saveLiveConfig({ url: url.trim(), anonKey: key.trim() });
    setSavedCfg(true); window.setTimeout(() => setSavedCfg(false), 2000);
  };
  const removeOwn = () => { saveLiveConfig(null); setUrl(''); setKey(''); };

  const copyLink = async () => {
    if (!myCode) return;
    try { await navigator.clipboard.writeText(liveLink(myCode, cfg)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <section className="bg-panel rounded-3xl p-4 border border-white/10 space-y-3">
      <h3 className="font-black text-white text-lg flex items-center gap-2"><Radio className="w-5 h-5 text-sky-400" /> Theo dõi trực tiếp</h3>

      {cfg ? (
        <>
          <div className="bg-black/30 rounded-2xl p-3.5 border border-white/10 text-center">
            <p className="text-xs text-slate-400 font-bold">MÃ TRỰC TIẾP CỦA BẠN</p>
            <p className="text-3xl font-black tracking-[0.3em] text-white">{myCode || '--------'}</p>
            <p className="text-xs text-slate-400 mt-1">Gửi link này cho người nhà là họ thấy bạn trên bản đồ.</p>
          </div>
          <button onClick={copyLink} className="w-full bg-white/10 border border-slate-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
            <Copy className="w-4 h-4" /> {copied ? 'ĐÃ CHÉP LINK ✓' : 'Chép link xem trực tiếp'}
          </button>
        </>
      ) : (
        <p className="text-sm text-amber-300 font-semibold">Xem trực tiếp đang tạm tắt (máy chủ đang được bật lên). Mọi tính năng khác vẫn chạy, SOS vẫn gửi SMS vị trí như thường.</p>
      )}

      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nhập mã của người thân" value={watchCode} onChange={(e) => setWatchCode(e.target.value.toUpperCase())} maxLength={10} />
        <button onClick={() => { if (watchCode.trim().length >= 6) onOpenLive(watchCode.trim()); }} className="shrink-0 bg-success text-white font-black px-4 rounded-2xl flex items-center gap-1.5"><Eye className="w-4 h-4" /> XEM</button>
      </div>
      <p className="text-[11px] text-slate-500 flex items-center gap-1"><Link2 className="w-3 h-3" /> Mất mạng: app tự nhắc gửi SMS vị trí.</p>

      <details className="group">
        <summary className="text-xs text-slate-500 font-bold cursor-pointer flex items-center gap-1 list-none">Nâng cao: dùng trạm riêng của bạn <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition" /></summary>
        <div className="pt-2.5 space-y-2">
          {own ? (
            <>
              <p className="text-xs text-emerald-300 font-semibold">Đang dùng trạm riêng của bạn (ưu tiên hơn trạm chung).</p>
              <button onClick={removeOwn} className="w-full bg-white/10 border border-slate-600 text-white font-bold py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm"><Trash2 className="w-4 h-4" /> Bỏ trạm riêng, về trạm chung</button>
            </>
          ) : (
            <>
              <input className={inputCls} placeholder="Project URL (https://xxx.supabase.co)" value={url} onChange={(e) => setUrl(e.target.value)} />
              <input className={inputCls} placeholder="anon key (khóa công khai)" value={key} onChange={(e) => setKey(e.target.value)} />
              <button onClick={save} className="w-full bg-primary text-white font-black py-2.5 rounded-2xl flex items-center justify-center gap-2 text-sm"><Save className="w-4 h-4" /> {savedCfg ? 'ĐÃ LƯU ✓' : 'LƯU TRẠM RIÊNG'}</button>
            </>
          )}
        </div>
      </details>
    </section>
  );
}

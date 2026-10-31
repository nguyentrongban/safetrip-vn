import { useMemo, useRef, useState } from 'react';
import { Camera, CircleCheck, Search, ShieldAlert, Trash2, TriangleAlert } from 'lucide-react';
import { BLACKLIST_DATABASE, CHECKLIST_QUESTIONS } from '../utils/data';
import { normalizePhone, normalizePlate } from '../utils/geo';
import { loadReports, saveReports } from '../utils/storage';
import type { PersonalReport } from '../types';

export default function SearchTab() {
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<PersonalReport[]>(() => loadReports());
  const [plate, setPlate] = useState(''); const [company, setCompany] = useState('');
  const [desc, setDesc] = useState(''); const [image, setImage] = useState<string | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => {
    const q = query.trim(); if (!q) return [];
    const np = normalizePlate(q); const nph = normalizePhone(q);
    return BLACKLIST_DATABASE.filter((e) =>
      (np.length >= 4 && normalizePlate(e.plate).includes(np)) ||
      e.company.toLowerCase().includes(q.toLowerCase()) ||
      (nph.length >= 9 && normalizePhone(e.phone) === nph));
  }, [query]);

  const yesCount = Object.values(answers).filter(Boolean).length;

  const onImage = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setImage(r.result as string);
    r.readAsDataURL(f);
  };

  const submitReport = () => {
    if (!plate.trim() || !desc.trim()) return;
    const item: PersonalReport = { id: `r${Date.now()}`, plate: plate.trim().toUpperCase(), company: company.trim() || 'Chưa rõ nhà xe', description: desc.trim(), imageDataUrl: image, createdAt: Date.now() };
    const next = [item, ...reports]; setReports(next); saveReports(next);
    setPlate(''); setCompany(''); setDesc(''); setImage(null); setReportSaved(true);
    window.setTimeout(() => setReportSaved(false), 2500);
  };

  const removeReport = (id: string) => { const next = reports.filter((r) => r.id !== id); setReports(next); saveReports(next); };
  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="font-black text-white text-lg flex items-center gap-2"><Search className="w-5 h-5 text-blue-400" /> Xe này có lừa đảo không?</h3>
        <input className={inputCls} placeholder="Gõ biển số xe hoặc số điện thoại" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim() && (hits.length > 0 ? hits.map((h) => (
          <div key={h.id} className="bg-red-500/10 border-2 border-red-500 rounded-2xl p-4 space-y-1">
            <p className="text-red-400 font-black flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> CẢNH BÁO {h.risk === 'CRITICAL' ? 'CỰC KỲ NGUY HIỂM' : 'RỦI RO CAO'}</p>
            <p className="text-white font-bold text-lg">{h.plate} — {h.company}</p>
            <p className="text-sm text-slate-200">SĐT: {h.phone} · Bị báo cáo: {h.reports} lần · Gặp gần nhất: {h.lastSeen}</p>
            <p className="text-sm text-red-200">{h.reason}</p>
            <p className="text-base font-black text-white pt-1">⛔ ĐỪNG LÊN XE NÀY. Bị ép lên xe → gọi 113.</p>
          </div>
        )) : (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-2xl p-4 text-emerald-200 text-sm flex gap-2">
            <CircleCheck className="w-5 h-5 shrink-0" /> Chưa có dữ liệu cảnh báo cho "{query}" trong danh sách đen hiện tại. Vẫn hãy chụp biển số gửi người thân trước khi lên xe.
          </div>
        ))}
      </section>

      <section className="bg-panel rounded-2xl p-4 border border-slate-700/60 space-y-3">
        <h3 className="font-black text-white text-lg">Bạn có đang gặp nguy hiểm?</h3>
        <p className="text-sm text-slate-400 -mt-1">Trả lời 5 câu. CÓ từ 2 câu trở lên = nguy hiểm.</p>
        {CHECKLIST_QUESTIONS.map((q, i) => (
          <div key={q.id} className="bg-slate-900 rounded-xl p-3 border border-slate-700/60">
            <p className="text-base text-white font-semibold">{i + 1}. {q.text}</p>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setAnswers({ ...answers, [q.id]: true })} className={`flex-1 py-3 rounded-xl text-base font-black ${answers[q.id] === true ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}>CÓ ⚠️</button>
              <button onClick={() => setAnswers({ ...answers, [q.id]: false })} className={`flex-1 py-3 rounded-xl text-base font-black ${answers[q.id] === false ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>KHÔNG</button>
            </div>
          </div>
        ))}
        {Object.keys(answers).length > 0 && (
          yesCount >= 2 ? (
            <div className="bg-red-600 text-white rounded-xl p-4 font-black text-center animate-blink-red">🚨 RỦI RO CAO — BẠN NÊN TÌM CÁCH XUỐNG XE NGAY!<br /><span className="text-sm font-bold">Xuống tại trạm xăng / chỗ đông người, gọi 113, giữ nút SOS ở tab Home.</span></div>
          ) : yesCount === 1 ? (
            <div className="bg-amber-500/15 border border-amber-500 rounded-xl p-3 text-amber-200 text-sm font-bold flex gap-2"><TriangleAlert className="w-5 h-5 shrink-0" /> Có 1 dấu hiệu bất thường. Hãy cảnh giác, bật Giám Sát lộ trình và chia sẻ vị trí cho người thân ngay.</div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-3 text-emerald-200 text-sm font-bold">Chưa thấy dấu hiệu nguy hiểm. Vẫn duy trì chia sẻ vị trí suốt chuyến đi.</div>
          )
        )}
      </section>

      <section className="bg-panel rounded-2xl p-4 border border-slate-700/60 space-y-3">
        <h3 className="font-bold text-white">Báo cáo xe dù / lừa đảo</h3>
        <input className={inputCls} placeholder="Biển số xe *" value={plate} onChange={(e) => setPlate(e.target.value)} />
        <input className={inputCls} placeholder="Tên nhà xe (nếu biết)" value={company} onChange={(e) => setCompany(e.target.value)} />
        <textarea className={inputCls} rows={3} placeholder="Mô tả hành vi *" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
        <button onClick={() => fileRef.current?.click()} className="w-full bg-slate-800 border border-dashed border-slate-600 text-slate-200 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm"><Camera className="w-4 h-4" /> {image ? 'Đã chọn ảnh — bấm để đổi' : 'Tải ảnh bằng chứng (xem trước)'}</button>
        {image && <img src={image} alt="Ảnh bằng chứng" className="w-full rounded-xl border border-slate-700 object-cover max-h-44" />}
        <button onClick={submitReport} disabled={!plate.trim() || !desc.trim()} className="w-full bg-warning text-slate-900 font-black py-2.5 rounded-xl disabled:opacity-40">{reportSaved ? 'ĐÃ LƯU BÁO CÁO ✓' : 'GỬI BÁO CÁO (lưu trên máy)'}</button>
        {reports.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-400 font-bold">Danh sách đen cá nhân của bạn ({reports.length})</p>
            {reports.map((r) => (
              <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex gap-3">
                {r.imageDataUrl && <img src={r.imageDataUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-white font-bold text-sm">{r.plate} — {r.company}</p>
                  <p className="text-xs text-slate-300 line-clamp-2">{r.description}</p>
                  <p className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                <button onClick={() => removeReport(r.id)} className="text-slate-500 hover:text-red-400 shrink-0" aria-label="Xóa báo cáo"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

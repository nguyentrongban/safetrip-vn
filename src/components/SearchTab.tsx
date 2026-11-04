import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, ChevronDown, CircleCheck, Flag, Search, ShieldAlert, Trash2, TriangleAlert, X } from 'lucide-react';
import { BLACKLIST_DATABASE, CHECKLIST_QUESTIONS, PROVINCES } from '../utils/data';
import { normalizePhone, normalizePlate } from '../utils/geo';
import { loadReports, saveReports } from '../utils/storage';
import { cloudinaryReady, cloudinaryThumb, compressImage, isValidVnPhone, normalizeVnPhone, searchCommunity, submitCommunityReport, uploadEvidence, validateImageFile } from '../utils/fraudDb';
import { fetchProvinces, fetchWards, type VnProvince, type VnWard } from '../utils/vnAdmin';
import type { CommunityFraudEntry, PersonalReport } from '../types';

const SCAM_TYPES = ['Lừa đảo việc làm / nguy cơ bán người', 'Xe dù, không giấy phép', 'Thu giữ CCCD / điện thoại', 'Ép chuyển xe giữa đường', 'Chặt chém / đòi thêm tiền', 'Khác'];

interface PhotoItem { id: string; blob: Blob; preview: string; kb: number }

export default function SearchTab() {
  const [query, setQuery] = useState('');
  const [community, setCommunity] = useState<CommunityFraudEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [communityDown, setCommunityDown] = useState(false);
  const [reports, setReports] = useState<PersonalReport[]>(() => loadReports());
  const [plate, setPlate] = useState(''); const [company, setCompany] = useState('');
  const [phone, setPhone] = useState(''); const [scamType, setScamType] = useState(SCAM_TYPES[0]);
  const [area, setArea] = useState(''); const [desc, setDesc] = useState('');
  // Khu vực theo API hành chính VN sau sáp nhập: tỉnh/thành (34) → phường/xã.
  const [provinces, setProvinces] = useState<VnProvince[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | ''>('');
  const [provinceName, setProvinceName] = useState('');
  const [wards, setWards] = useState<VnWard[]>([]);
  const [wardName, setWardName] = useState('');
  const [adminOffline, setAdminOffline] = useState(false);

  useEffect(() => {
    fetchProvinces().then(setProvinces).catch(() => setAdminOffline(true));
  }, []);

  useEffect(() => {
    if (provinceCode === '') { setWards([]); return; }
    let alive = true;
    fetchWards(provinceCode).then((w) => { if (alive) setWards(w); }).catch(() => { if (alive) setWards([]); });
    return () => { alive = false; };
  }, [provinceCode]);

  const pickProvince = (code: number | '', name: string) => {
    setProvinceCode(code); setProvinceName(name); setWardName(''); setWards([]);
    setArea(name);
  };
  const pickWard = (name: string) => {
    setWardName(name);
    setArea(name ? `${name}, ${provinceName}` : provinceName);
  };
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Community search (approved reports only), debounced. Falls back silently
  // to the built-in list when offline / the community DB is unreachable.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setCommunity([]); setSearching(false); setCommunityDown(false); return; }
    setSearching(true);
    const id = window.setTimeout(() => {
      searchCommunity(q)
        .then((rows) => { setCommunity(rows); setCommunityDown(false); })
        .catch(() => { setCommunity([]); setCommunityDown(true); })
        .finally(() => setSearching(false));
    }, 500);
    return () => window.clearTimeout(id);
  }, [query]);

  const communityPlates = useMemo(() => new Set(community.map((c) => c.plate)), [community]);

  const hits = useMemo(() => {
    const q = query.trim(); if (!q) return [];
    const np = normalizePlate(q); const nph = normalizePhone(q);
    return BLACKLIST_DATABASE.filter((e) =>
      !communityPlates.has(normalizePlate(e.plate)) &&
      ((np.length >= 4 && normalizePlate(e.plate).includes(np)) ||
        e.company.toLowerCase().includes(q.toLowerCase()) ||
        (nph.length >= 9 && normalizePhone(e.phone) === nph)));
  }, [query, communityPlates]);

  const yesCount = Object.values(answers).filter(Boolean).length;

  // v1.20 validation: exactly ONE photo per report, images only, ≤10MB
  // (checked on the original file, before compression).
  const onImages = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const err = validateImageFile(f);
    if (err) { setPhotoError(err); return; }
    setPhotoError(null); setPhotoBusy(true);
    try {
      const blob = await compressImage(f);
      setPhotos([{ id: `p${Date.now()}`, blob, preview: URL.createObjectURL(blob), kb: Math.round(blob.size / 1024) }]);
    } catch { setPhotoError('Không đọc được file ảnh này — chọn ảnh khác nhé.'); }
    setPhotoBusy(false);
  };

  const plateValid = normalizePlate(plate).length >= 6 && normalizePlate(plate).length <= 11;
  const phoneValid = isValidVnPhone(phone);
  const descValid = desc.trim().length >= 10 && desc.trim().length <= 200;
  // v1.21/1.22: every field is required EXCEPT the operator name — when it
  // is left empty the report is stored as "Chưa xác định".
  const areaValid = provinceName !== '' && wardName.trim() !== '';
  const formValid = plateValid && phoneValid && descValid && areaValid;

  const removePhoto = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const blobToDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(b); });

  const submitReport = async () => {
    if (!formValid || sending) return;
    setSending(true); setSendNote(null);
    let imageUrls: string[] = [];
    let photoNote = '';
    if (photos.length > 0) {
      if (cloudinaryReady()) {
        try { for (const p of photos) imageUrls.push(await uploadEvidence(p.blob)); }
        catch { imageUrls = []; photoNote = ' Gửi ảnh bị lỗi nên báo cáo này chưa có ảnh.'; }
      } else {
        photoNote = ' Ảnh chưa được gửi lên (tính năng ảnh đang chờ bật) — báo cáo chữ vẫn được gửi.';
      }
    }
    let sent = false;
    try {
      await submitCommunityReport({ plate: plate.trim().toUpperCase(), operatorName: company.trim() || 'Chưa xác định', phone: phone.trim(), scamType, area, description: desc.trim(), imageUrls });
      sent = true;
    } catch { sent = false; }

    // Always keep a personal copy on this phone, like before.
    const localImg = imageUrls[0] || (photos[0] ? await blobToDataUrl(photos[0].blob) : null);
    const item: PersonalReport = { id: `r${Date.now()}`, plate: plate.trim().toUpperCase(), company: company.trim() || 'Chưa xác định', description: desc.trim(), imageDataUrl: localImg, createdAt: Date.now() };
    const next = [item, ...reports]; setReports(next); saveReports(next);

    setSendNote(sent
      ? `ĐÃ GỬI ✓ Báo cáo đã lên kho chung — sẽ hiện cho mọi người tra cứu sau khi được duyệt.${photoNote}`
      : 'Đã lưu trong máy bạn. Chưa gửi được lên kho chung (mất mạng hoặc kho đang bảo trì) — mở lại app và gửi lại sau nhé.');
    setPlate(''); setCompany(''); setPhone(''); setDesc(''); setArea(''); setProvinceCode(''); setProvinceName(''); setWardName(''); setWards([]); setPhotos([]); setPhotoError(null);
    setSending(false);
    window.setTimeout(() => setSendNote(null), 6000);
  };

  const removeReport = (id: string) => { const next = reports.filter((r) => r.id !== id); setReports(next); saveReports(next); };
  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="font-black text-white text-xl tracking-tight">Tra cứu xe lừa đảo</h3>
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full bg-black/30 border border-white/10 rounded-full pl-12 pr-4 py-3.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition-colors shadow-lg"
            placeholder="Biển số, tên nhà xe, số điện thoại"
            value={query}
            maxLength={40}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {searching && <p className="text-xs text-slate-400">Đang tra trong kho cộng đồng…</p>}
        {communityDown && query.trim().length >= 3 && <p className="text-[11px] text-slate-500">Chưa kết nối được kho cộng đồng — kết quả dưới đây là danh sách có sẵn trong máy.</p>}

        {community.map((c) => (
          <div key={c.plate + c.createdAt} className="bg-red-500/10 border-2 border-red-500 rounded-2xl p-4 space-y-1.5">
            <p className="text-red-400 font-black flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> CẢNH BÁO TỪ CỘNG ĐỒNG</p>
            <p className="text-white font-bold text-lg">{c.plateDisplay} — {c.operatorName || 'Chưa xác định'}</p>
            <p className="text-sm text-slate-200">
              {c.scamType && <>{c.scamType} · </>}{c.area && <>Khu vực: {c.area} · </>}Đã có {c.reportCount} báo cáo được duyệt
            </p>
            <p className="text-sm text-red-200">{c.description}</p>
            {c.imageUrls.length > 0 && (
              <div className="flex gap-2 pt-1">
                {c.imageUrls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={cloudinaryThumb(u)} alt="Ảnh bằng chứng" className="w-20 h-20 rounded-lg object-cover border border-red-500/40" /></a>
                ))}
              </div>
            )}
            <p className="text-base font-black text-white pt-1">⛔ ĐỪNG LÊN XE NÀY. Bị ép lên xe → gọi 113.</p>
          </div>
        ))}

        {query.trim() && (hits.length > 0 ? hits.map((h) => (
          <div key={h.id} className="bg-red-500/10 border-2 border-red-500 rounded-2xl p-4 space-y-1">
            <p className="text-red-400 font-black flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> CẢNH BÁO {h.risk === 'CRITICAL' ? 'CỰC KỲ NGUY HIỂM' : 'RỦI RO CAO'}</p>
            <p className="text-white font-bold text-lg">{h.plate} — {h.company}</p>
            <p className="text-sm text-slate-200">SĐT: {h.phone} · Bị báo cáo: {h.reports} lần · Gặp gần nhất: {h.lastSeen}</p>
            <p className="text-sm text-red-200">{h.reason}</p>
            <p className="text-base font-black text-white pt-1">⛔ ĐỪNG LÊN XE NÀY. Bị ép lên xe → gọi 113.</p>
          </div>
        )) : community.length === 0 && !searching && (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-2xl p-4 text-emerald-200 text-sm flex gap-2">
            <CircleCheck className="w-5 h-5 shrink-0" /> Chưa có dữ liệu cảnh báo cho "{query}" trong kho cộng đồng và danh sách đen hiện tại. Vẫn hãy chụp biển số gửi người thân trước khi lên xe.
          </div>
        ))}
      </section>

      <section className="bg-panel rounded-2xl p-4 border border-white/10 space-y-3">
        <h3 className="font-black text-white text-lg">Bạn có đang gặp nguy hiểm?</h3>
        <p className="text-sm text-slate-400 -mt-1">Trả lời 5 câu. CÓ từ 2 câu trở lên = nguy hiểm.</p>
        {CHECKLIST_QUESTIONS.map((q, i) => (
          <div key={q.id} className="bg-black/30 rounded-xl p-3 border border-white/10">
            <p className="text-base text-white font-semibold">{i + 1}. {q.text}</p>
            <div className="flex gap-2 mt-2.5">
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setAnswers({ ...answers, [q.id]: true })} className={`flex-1 py-3 rounded-full text-base font-black transition-colors ${answers[q.id] === true ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-300'}`}>CÓ ⚠️</motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setAnswers({ ...answers, [q.id]: false })} className={`flex-1 py-3 rounded-full text-base font-black transition-colors ${answers[q.id] === false ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-300'}`}>KHÔNG</motion.button>
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

      <section className="bg-panel rounded-3xl p-4 border border-white/10">
        <button onClick={() => setShowForm((v) => !v)} className="w-full flex items-center gap-2 text-left">
          <Flag className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="flex-1 font-bold text-white">Báo cáo xe dù / lừa đảo</span>
          {reports.length > 0 && <span className="text-[11px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full font-bold shrink-0">{reports.length} đã báo</span>}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition shrink-0 ${showForm ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
              <div className="space-y-3 pt-3">
                <p className="text-xs text-slate-400">Sẽ hiện cho mọi người tra cứu sau khi được duyệt.</p>
        <input className={inputCls} placeholder="Biển số xe *" value={plate} maxLength={15} onChange={(e) => setPlate(e.target.value)} />
        {plate.trim() && !plateValid && <p className="text-xs text-red-400 font-semibold -mt-1">Biển số chưa đúng định dạng (ví dụ: 51B-123.45).</p>}
        <input className={inputCls} placeholder="Tên nhà xe (không biết thì bỏ trống)" value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} />
        <input className={inputCls} placeholder="Số điện thoại nhà xe / tài xế *" value={phone} maxLength={11} inputMode="numeric" onChange={(e) => setPhone(normalizeVnPhone(e.target.value))} />
        {phone && !phoneValid && <p className="text-xs text-red-400 font-semibold -mt-1">SĐT chưa đúng: cần 9–11 số và bắt đầu bằng số 0.</p>}
        <select className={inputCls} value={scamType} onChange={(e) => setScamType(e.target.value)}>
          {SCAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-2">
          <select
            className={inputCls}
            value={provinceCode === '' ? provinceName : String(provinceCode)}
            onChange={(e) => {
              const opt = e.target.selectedOptions[0];
              const code = opt?.dataset.code ? Number(opt.dataset.code) : '';
              pickProvince(code as number | '', e.target.value === '' ? '' : (opt?.dataset.name || e.target.value));
            }}
          >
            <option value="">Tỉnh / thành phố *…</option>
            {provinces.length > 0
              ? provinces.map((p) => <option key={p.code} value={String(p.code)} data-code={p.code} data-name={p.name}>{p.name}</option>)
              : PROVINCES.map((p) => <option key={p} value={p} data-name={p}>{p}</option>)}
          </select>
          {adminOffline ? (
            <input className={inputCls} placeholder="Phường / xã (tự ghi)" value={wardName} onChange={(e) => pickWard(e.target.value)} />
          ) : (
            <select className={inputCls} value={wardName} disabled={provinceCode === '' || wards.length === 0} onChange={(e) => pickWard(e.target.value)}>
              <option value="">{provinceCode === '' ? 'Chọn tỉnh trước…' : wards.length === 0 ? 'Đang tải phường/xã…' : 'Phường / xã *…'}</option>
              {wards.map((w) => <option key={w.code} value={w.name}>{w.name}</option>)}
            </select>
          )}
        </div>
        <textarea className={inputCls} rows={3} placeholder="Mô tả hành vi (tối đa 200 chữ) *" value={desc} maxLength={200} onChange={(e) => setDesc(e.target.value)} />
        <div className="flex justify-between -mt-1">
          {desc.trim() && !descValid ? <p className="text-xs text-red-400 font-semibold">Mô tả cần từ 10 đến 200 ký tự.</p> : <span />}
          <p className="text-[10px] text-slate-500">{desc.length}/200</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onImages(e.target.files); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={photoBusy} className="w-full bg-white/10 border border-dashed border-slate-600 text-slate-200 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-40"><Camera className="w-4 h-4" /> {photoBusy ? 'Đang nén ảnh…' : photos.length > 0 ? 'Đã chọn 1 ảnh — bấm để đổi tấm khác' : 'Thêm ảnh bằng chứng (1 tấm, tối đa 10MB, app tự nén nhỏ)'}</button>
        {photoError && <p className="text-xs text-red-400 font-semibold">{photoError}</p>}
        {photos.length > 0 && (
          <div className="flex gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <img src={p.preview} alt="Ảnh bằng chứng" className="w-20 h-20 rounded-lg object-cover border border-white/10" />
                <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded">{p.kb}KB</span>
                <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5" aria-label="Bỏ ảnh này"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        {!formValid && <p className="text-[11px] text-slate-500 -mb-1">Điền đủ các ô * mới gửi được.</p>}
        <button onClick={() => void submitReport()} disabled={!formValid || sending} className="w-full bg-warning text-slate-900 font-black py-3 rounded-full disabled:opacity-40 active:scale-[0.98] transition">{sending ? 'ĐANG GỬI…' : 'GỬI BÁO CÁO'}</button>
        {sendNote && <p className="text-sm text-emerald-300 font-semibold bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3">{sendNote}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {reports.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-400 font-bold">Danh sách đen cá nhân của bạn ({reports.length})</p>
            {reports.map((r) => (
              <div key={r.id} className="bg-black/30 border border-white/10 rounded-xl p-3 flex gap-3">
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

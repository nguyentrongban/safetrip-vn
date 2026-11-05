import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Ban, Camera, Car, ChevronDown, CircleAlert, CircleCheck, Flag, MapPin, Phone, Search, ShieldAlert, Trash2, TriangleAlert, X } from 'lucide-react';
import { BLACKLIST_DATABASE, CHECKLIST_QUESTIONS, PROVINCES } from '../utils/data';
import { normalizePhone, normalizePlate } from '../utils/geo';
import { loadReports, saveReports } from '../utils/storage';
import { cloudinaryReady, cloudinaryThumb, compressImage, isValidVnPhone, normalizeVnPhone, searchCommunity, submitCommunityReport, uploadEvidence, validateImageFile } from '../utils/fraudDb';
import { fetchProvinces, fetchWards, type VnProvince, type VnWard } from '../utils/vnAdmin';
import type { CommunityFraudEntry, PersonalReport } from '../types';

const SCAM_TYPES = ['Lừa đảo việc làm / nguy cơ bán người', 'Xe dù, không giấy phép', 'Thu giữ CCCD / điện thoại', 'Ép chuyển xe giữa đường', 'Chặt chém / đòi thêm tiền', 'Khác'];

interface PhotoItem { id: string; blob: Blob; preview: string; kb: number }

// Form draft (v1.65): a page reload must not wipe a half-filled
// report. Text fields only, kept for this browser session — the photo
// itself cannot be stored and has to be picked again after a reload.
const DRAFT_KEY = 'safetrip_search_draft_v1';
interface SearchDraft { query?: string; plate?: string; company?: string; phone?: string; scamType?: string; area?: string; desc?: string; provinceCode?: number | ''; provinceName?: string; wardName?: string; showForm?: boolean }
function loadDraft0(): SearchDraft { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') as SearchDraft; } catch { return {}; } }
const draft0 = loadDraft0();

export default function SearchTab() {
  const [query, setQuery] = useState(() => draft0.query ?? '');
  const [community, setCommunity] = useState<CommunityFraudEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [communityDown, setCommunityDown] = useState(false);
  const [reports, setReports] = useState<PersonalReport[]>(() => loadReports());
  const [plate, setPlate] = useState(() => draft0.plate ?? ''); const [company, setCompany] = useState(() => draft0.company ?? '');
  const [phone, setPhone] = useState(() => draft0.phone ?? ''); const [scamType, setScamType] = useState(() => draft0.scamType ?? SCAM_TYPES[0]);
  const [area, setArea] = useState(() => draft0.area ?? ''); const [desc, setDesc] = useState(() => draft0.desc ?? '');
  // Khu vực theo API hành chính VN sau sáp nhập: tỉnh/thành (34) → phường/xã.
  const [provinces, setProvinces] = useState<VnProvince[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | ''>(() => draft0.provinceCode ?? '');
  const [provinceName, setProvinceName] = useState(() => draft0.provinceName ?? '');
  const [wards, setWards] = useState<VnWard[]>([]);
  const [wardName, setWardName] = useState(() => draft0.wardName ?? '');
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
  const [showForm, setShowForm] = useState(() => draft0.showForm ?? false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ query, plate, company, phone, scamType, area, desc, provinceCode, provinceName, wardName, showForm })); } catch { /* storage blocked */ }
  }, [query, plate, company, phone, scamType, area, desc, provinceCode, provinceName, wardName, showForm]);
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
  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

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

        {query.trim().length >= 3 && (
          <div>
            <button type="button" onClick={() => setShowDisclaimer((v) => !v)} className="flex items-start gap-1.5 text-left w-full">
              <CircleAlert className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-px" />
              <span className="text-[11px] leading-4 text-slate-500">Thông tin do cộng đồng đóng góp, chưa được kiểm chứng 100% — chỉ để tham khảo phòng tránh. <span className="text-slate-400 underline underline-offset-2">{showDisclaimer ? 'Thu gọn' : 'Xem thêm'}</span></span>
            </button>
            <AnimatePresence>
              {showDisclaimer && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <p className="mt-2 bg-black/30 border border-white/10 rounded-2xl p-3 text-xs leading-5 text-slate-400">Các báo cáo ở đây do người dùng gửi lên và được duyệt đăng để cộng đồng tham khảo, phòng tránh rủi ro. SafeTrip VN không khẳng định thông tin chính xác tuyệt đối, và nội dung không nhằm bôi nhọ hay nhắm vào bất kỳ cá nhân, tổ chức nào. Thông tin nào chưa đúng sẽ được gỡ bỏ khi phát hiện.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {(community.length > 0 || hits.length > 0) && (
          <div className="bg-panel border border-white/10 rounded-3xl divide-y divide-white/5 overflow-hidden">
            {community.map((c) => (
              <motion.div key={c.plate + c.createdAt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3.5 flex gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 min-w-0">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-white font-extrabold text-[17px] tracking-tight shrink-0">{c.plateDisplay}</span>
                    <span className="text-[13px] text-slate-400 truncate">{c.operatorName || 'Chưa xác định'}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0"><BadgeCheck className="w-3.5 h-3.5 text-emerald-400" /> {c.reportCount}</span>
                  </p>
                  {(c.scamType || c.area) && (
                    <p className="flex items-center gap-3 text-xs text-slate-300 min-w-0">
                      {c.scamType && <span className="inline-flex items-center gap-1 min-w-0"><TriangleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" /><span className="truncate">{c.scamType}</span></span>}
                      {c.area && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" /><span className="truncate">{c.area}</span></span>}
                    </p>
                  )}
                  {c.description && <p className="text-xs text-slate-400 leading-4 line-clamp-2">{c.description}</p>}
                  <p className="flex items-center gap-1 text-red-400 font-black text-[11px] tracking-wide pt-0.5"><Ban className="w-3.5 h-3.5" /> ĐỪNG LÊN XE NÀY</p>
                </div>
                {c.imageUrls.length > 0 && (
                  <a href={c.imageUrls[0]} target="_blank" rel="noreferrer" className="relative shrink-0 self-start">
                    <img src={cloudinaryThumb(c.imageUrls[0])} alt="Ảnh bằng chứng" loading="lazy" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                    {c.imageUrls.length > 1 && <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">+{c.imageUrls.length - 1}</span>}
                  </a>
                )}
              </motion.div>
            ))}
            {hits.map((h) => (
              <motion.div key={h.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3.5 space-y-1">
                <p className="flex items-center gap-1.5 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-white font-extrabold text-[17px] tracking-tight shrink-0">{h.plate}</span>
                  <span className="text-[13px] text-slate-400 truncate">{h.company}</span>
                  <span className={`ml-auto text-[11px] font-black shrink-0 ${h.risk === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>{h.risk === 'CRITICAL' ? 'CỰC KỲ NGUY HIỂM' : 'RỦI RO CAO'}</span>
                </p>
                <p className="flex items-center gap-3 text-xs text-slate-300 min-w-0">
                  <span className="inline-flex items-center gap-1 shrink-0"><Phone className="w-3.5 h-3.5 text-slate-400" /> {h.phone}</span>
                  <span className="inline-flex items-center gap-1 min-w-0"><Flag className="w-3.5 h-3.5 text-red-400 shrink-0" /><span className="truncate">Bị báo {h.reports} lần · gần nhất {h.lastSeen}</span></span>
                </p>
                {h.reason && <p className="text-xs text-slate-400 leading-4 line-clamp-2">{h.reason}</p>}
                <p className="flex items-center gap-1 text-red-400 font-black text-[11px] tracking-wide pt-0.5"><Ban className="w-3.5 h-3.5" /> ĐỪNG LÊN XE NÀY</p>
              </motion.div>
            ))}
          </div>
        )}

        {query.trim() && hits.length === 0 && community.length === 0 && !searching && (
          <div className="bg-panel border border-white/10 rounded-3xl p-4 flex gap-2.5">
            <CircleCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <p className="text-sm text-slate-300">Chưa có cảnh báo cho "{query}". <span className="text-slate-400">Vẫn nên chụp biển số gửi người thân trước khi lên xe.</span></p>
          </div>
        )}
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

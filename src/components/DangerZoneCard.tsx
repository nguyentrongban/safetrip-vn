import { useCallback, useEffect, useState } from 'react';
import { LocateFixed, MapPinPlus, TriangleAlert } from 'lucide-react';
import {
  ZONE_TYPE_META, namesMatch, reportDangerZone, reverseCommune,
  type CommuneZone, type DangerZoneType,
} from '../utils/dangerZones';
import { fetchProvinces, fetchWards, type VnProvince, type VnWard } from '../utils/vnAdmin';

interface Props {
  lat: number | null;
  lng: number | null;
  zones: CommuneZone[];
}

const inputCls = 'w-full bg-white/10 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-sky-500 disabled:opacity-50';

/**
 * "Khu vực nguy hiểm" card (v1.42 — commune edition) — legend for the
 * tinted communes on the monitor map + the community report form. A
 * report names a whole xã/phường (province → ward picker, pre-fillable
 * from the traveler's current position), lands as 'pending' on the relay
 * and only lights that commune up on everyone's map after the owner
 * approves it.
 */
export default function DangerZoneCard({ lat, lng, zones }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DangerZoneType>('cuop-giat');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  const [provinces, setProvinces] = useState<VnProvince[]>([]);
  const [provinceCode, setProvinceCode] = useState<number | ''>('');
  const [provinceName, setProvinceName] = useState('');
  const [wards, setWards] = useState<VnWard[]>([]);
  const [wardCode, setWardCode] = useState<number>(0);
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

  const pickProvince = useCallback((code: number | '', name: string) => {
    setProvinceCode(code); setProvinceName(name);
    setWardCode(0); setWardName('');
  }, []);

  const pickWard = useCallback((name: string) => {
    setWardName(name);
    setWardCode(wards.find((w) => w.name === name)?.code ?? 0);
  }, [wards]);

  /** "Use the commune I'm standing in": reverse-geocode the GPS point,
   *  then select the matching province + ward in the picker lists. */
  const useCurrentCommune = async () => {
    if (lat === null || lng === null || locating) return;
    setLocating(true); setNote('');
    const hit = await reverseCommune(lat, lng);
    setLocating(false);
    if (!hit) { setNote('Chưa xác định được xã/phường từ vị trí — bạn tự chọn ở dưới nhé.'); return; }
    const prov = provinces.find((p) => namesMatch(p.name, hit.province));
    if (!prov) { setNote(`Bạn đang ở ${hit.ward}, ${hit.province} — hãy tự chọn tỉnh/xã ở dưới.`); return; }
    pickProvince(prov.code, prov.name);
    try {
      const ws = await fetchWards(prov.code);
      setWards(ws);
      const w = ws.find((x) => namesMatch(x.name, hit.ward));
      if (w) { setWardName(w.name); setWardCode(w.code); }
      else setNote(`Bạn đang ở ${hit.ward} — danh sách xã/phường chưa khớp tên, bạn chọn lại giúp.`);
    } catch { setNote('Chưa tải được danh sách xã/phường.'); }
  };

  const descOk = description.trim().length >= 10 && description.trim().length <= 200;
  const areaOk = provinceName.trim() !== '' && wardName.trim() !== '';
  const canSubmit = areaOk && descOk && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setNote('');
    try {
      await reportDangerZone({
        provinceCode: provinceCode === '' ? 0 : provinceCode, provinceName: provinceName.trim(),
        wardCode, wardName: wardName.trim(),
        type, description: description.trim(), lat, lng,
      });
      setDone(true);
      setOpen(false);
      setDescription('');
    } catch {
      setNote('Chưa gửi được — kiểm tra mạng rồi thử lại.');
    } finally { setBusy(false); }
  };

  return (
    <section className="bg-panel rounded-3xl p-4 border border-white/10 space-y-3">
      <h3 className="font-black text-white text-lg flex items-center gap-2">
        <TriangleAlert className="w-5 h-5 text-amber-400" /> Khu vực nguy hiểm
        {zones.length > 0 && (
          <span className="text-[11px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-bold">{zones.length} xã/phường</span>
        )}
      </h3>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(ZONE_TYPE_META) as DangerZoneType[]).map((t) => (
          <span key={t} className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: ZONE_TYPE_META[t].color }} />
            {ZONE_TYPE_META[t].short}
          </span>
        ))}
      </div>

      {done && (
        <p className="text-sm text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/40 rounded-2xl px-3 py-2.5">
          ✅ Đã gửi — duyệt xong sẽ tô màu xã/phường này.
        </p>
      )}

      {!open ? (
        <button
          onClick={() => { setOpen(true); setDone(false); }}
          className="w-full bg-white/10 border border-slate-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <MapPinPlus className="w-5 h-5 text-amber-400" /> Báo một khu vực nguy hiểm
        </button>
      ) : (
        <div className="space-y-3 bg-black/30 border border-white/10 rounded-2xl p-3.5">
          <button
            onClick={() => void useCurrentCommune()}
            disabled={lat === null || lng === null || locating || provinces.length === 0}
            className="w-full bg-sky-600/90 disabled:bg-white/15 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition text-sm"
          >
            <LocateFixed className="w-4 h-4" />
            {locating ? 'Đang xác định…' : lat === null ? 'Chưa có định vị để tự điền' : 'Dùng xã/phường nơi bạn đang đứng'}
          </button>

          {adminOffline ? (
            <div className="space-y-2">
              <input className={inputCls} placeholder="Tỉnh / thành phố *" value={provinceName} onChange={(e) => setProvinceName(e.target.value)} />
              <input className={inputCls} placeholder="Phường / xã *" value={wardName} onChange={(e) => { setWardName(e.target.value); setWardCode(0); }} />
              <p className="text-[11px] text-amber-300 font-bold">Danh sách hành chính đang không tải được — bạn tự ghi tên tỉnh và xã/phường nhé.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                className={inputCls}
                value={provinceCode === '' ? '' : String(provinceCode)}
                onChange={(e) => {
                  const c = e.target.value === '' ? '' : Number(e.target.value);
                  pickProvince(c, c === '' ? '' : (provinces.find((p) => p.code === c)?.name ?? ''));
                }}
              >
                <option value="">Tỉnh / thành phố *…</option>
                {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <select
                className={inputCls}
                value={wardName}
                disabled={provinceCode === '' || wards.length === 0}
                onChange={(e) => pickWard(e.target.value)}
              >
                <option value="">{provinceCode === '' ? 'Chọn tỉnh trước…' : wards.length === 0 ? 'Đang tải phường/xã…' : 'Phường / xã *…'}</option>
                {wards.map((w) => <option key={w.code} value={w.name}>{w.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ZONE_TYPE_META) as DangerZoneType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-bold border ${type === t ? 'text-white' : 'text-slate-400 border-slate-600'}`}
                style={type === t ? { background: ZONE_TYPE_META[t].color, borderColor: ZONE_TYPE_META[t].color } : undefined}
              >
                {ZONE_TYPE_META[t].short}
              </button>
            ))}
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Chuyện gì hay xảy ra ở xã/phường này? (ít nhất 10 ký tự)"
              className={`${inputCls} resize-none`}
            />
            <p className={`text-[11px] text-right ${descOk ? 'text-slate-500' : 'text-amber-300 font-bold'}`}>{description.trim().length}/200</p>
          </div>

          {note && <p className="text-sm text-amber-300 font-semibold">{note}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="flex-1 bg-amber-500 disabled:bg-white/15 disabled:text-slate-400 text-white font-black py-3 rounded-2xl active:scale-[0.98] transition"
            >
              {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-4 bg-white/10 border border-slate-600 text-slate-300 font-bold rounded-2xl"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

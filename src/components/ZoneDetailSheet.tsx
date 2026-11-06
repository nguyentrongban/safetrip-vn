import { useState } from 'react';
import { motion } from 'framer-motion';
import { CircleCheck, X } from 'lucide-react';
import {
  ZONE_TYPE_META, confirmDangerZone, formatZoneDate, groupZoneReports, loadConfirmedZoneIds,
  type CommuneZone, type DangerZoneType,
} from '../utils/dangerZones';

interface Props {
  zone: CommuneZone;
  type: DangerZoneType;
  onClose: () => void;
}

/**
 * Detail sheet behind a grouped map-popup row (owner 2026-11-06): every
 * approved report of ONE type in ONE commune — description, freshness
 * date, confirmations, and the per-report re-confirm button. The map
 * popup itself stays compact (one row per type with the totals); the
 * full reading lives here, in a sheet the traveler opens on purpose.
 */
export default function ZoneDetailSheet({ zone, type, onClose }: Props) {
  const meta = ZONE_TYPE_META[type];
  const group = groupZoneReports(zone).find((g) => g.type === type);
  const reports = group?.reports ?? [];
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(() => loadConfirmedZoneIds());

  const confirm = (id: string) => {
    setConfirmed((prev) => new Set(prev).add(id));
    void confirmDangerZone(id);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-panel w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 max-h-[82vh] flex flex-col overflow-hidden"
        initial={{ y: 44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 44, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="min-w-0 flex-1">
            <p className="text-white font-black text-base leading-snug">
              ⚠️ {zone.wardName}
              <span className="text-slate-400 font-bold"> — {zone.provinceName}</span>
            </p>
            <p className="font-extrabold mt-1.5 flex items-center gap-1.5" style={{ color: meta.color }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: meta.color }} />
              {meta.label}
            </p>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">
              {reports.length} báo cáo · {group?.totalConfirms ?? 0} lượt xác nhận
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-2 space-y-2.5">
          {reports.map((r) => {
            const done = confirmed.has(r.id);
            return (
              <div key={r.id} className="rounded-2xl bg-white/[.04] border border-white/[.07] p-3">
                <p className="text-slate-100 font-semibold leading-snug">{r.description}</p>
                <p className="text-slate-400 text-xs mt-1.5">
                  Cộng đồng báo · Cập nhật {formatZoneDate(r.updatedAt)} · {r.confirmCount} lượt xác nhận
                </p>
                <button
                  onClick={() => confirm(r.id)}
                  disabled={done}
                  className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold active:scale-95 transition ${
                    done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white text-slate-900'
                  }`}
                >
                  <CircleCheck size={15} />
                  {done ? 'Bạn đã xác nhận rồi' : 'Xác nhận báo cáo này'}
                </button>
              </div>
            );
          })}
          {reports.length === 0 && (
            <p className="text-slate-400 text-sm pb-2">Chưa có báo cáo nào thuộc loại này.</p>
          )}
        </div>

        <p className="px-4 py-3 text-[11px] text-slate-500 border-t border-white/[.06]">
          Tin cộng đồng, chưa kiểm chứng — chỉ để tham khảo phòng tránh.
        </p>
      </motion.div>
    </motion.div>
  );
}

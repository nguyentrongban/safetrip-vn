import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Play, ShieldCheck, Square, TriangleAlert } from 'lucide-react';
import MapView from './MapView';
import LivePanel from './LivePanel';
import PushNotifyCard from './PushNotifyCard';
import DangerZoneCard from './DangerZoneCard';
import LiveUpdateBanner from './LiveUpdateBanner';
import PlacePicker from './PlacePicker';
import type { GeoState } from '../hooks/useGeolocation';
import { formatCountdown, useDeadMansSwitch } from '../hooks/useDeadMansSwitch';
import { useLiveSmsUpdates } from '../hooks/useLiveSmsUpdates';
import { BORDER_LINES, BORDER_LINE_ALERT_KM, BORDER_POINTS, BORDER_RADIUS_KM } from '../utils/data';
import { distanceToBorderLine, formatKm, haversineKm, nearestBorder, remainingRoutePoints, routeProgress } from '../utils/geo';
import { fetchRoute, type RouteResult } from '../utils/routing';
import { loadTrip, saveTrip } from '../utils/storage';
import { ensureLiveSession, loadLiveSessionCode } from '../utils/live';
import { isPushConfigured, syncDmsDeadline } from '../utils/push';
import { ZONE_TYPE_META, buildCommuneZones, communeContains, fetchCommuneGeometry, fetchDangerReports, loadCachedReports, type CommuneZone, type DangerReport, type ZoneGeometry } from '../utils/dangerZones';
import type { PlacePoint, TripConfig } from '../types';

interface Props {
  geo: GeoState & { startWatch: () => void; stopWatch: () => void };
  onBorderAlarm: (borderName: string) => void;
  onDeadManTimeout: () => void;
  onOpenLive: (code: string) => void;
  alarming: boolean;
}

/* Off-route rules (v1.29), Grab-style: a small detour (dodging traffic)
 * is fine and just redraws the prediction; only a BIG, sustained miss —
 * or clearly driving AWAY from the destination — raises the alarm. */
const OFF_OK_KM = 0.8;          // within this of the line: on route
const OFF_ALARM_KM = 5;         // beyond this, sustained: alarm (tấn chốt 5 km)
const OFF_ALARM_MS = 30_000;    // …sustained this long
const REROUTE_COOLDOWN_MS = 180_000;
const WRONGWAY_WINDOW_MS = 240_000;
const WRONGWAY_MIN_SPAN_MS = 150_000;
const WRONGWAY_GAIN_KM = 1;     // destination got this much FARTHER

function fmtDuration(min: number): string {
  const total = Math.max(1, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} phút`;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type DevAlarm = { kind: 'off' | 'wrong'; offKm: number } | null;

export default function MonitorTab({ geo, onBorderAlarm, onDeadManTimeout, onOpenLive, alarming }: Props) {
  const [startPick, setStartPick] = useState<PlacePoint | null>(null);
  const [destPick, setDestPick] = useState<PlacePoint | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeFailed, setRouteFailed] = useState(false);
  const [trip, setTrip] = useState<TripConfig | null>(() => loadTrip());
  const [borderAlertedFor, setBorderAlertedFor] = useState<string | null>(null);
  const [devAlarm, setDevAlarm] = useState<DevAlarm>(null);
  const [liveRemainingKm, setLiveRemainingKm] = useState<number | null>(null);
  /** The route as drawn mid-trip: only the part still ahead (the blue
   * line burns away behind the driver). null = draw the stored route. */
  const [displayRoute, setDisplayRoute] = useState<[number, number][] | null>(null);
  const displayRouteRef = useRef<[number, number][] | null>(null);
  const [rerouteNote, setRerouteNote] = useState('');

  const routeKeyRef = useRef<string>('');
  const routeBusyRef = useRef(false);
  const offSinceRef = useRef<number | null>(null);
  const lastRerouteRef = useRef(0);
  const samplesRef = useRef<{ t: number; destKm: number }[]>([]);
  const devAlarmRef = useRef<DevAlarm>(null);
  devAlarmRef.current = devAlarm;
  const tripRef = useRef<TripConfig | null>(trip);
  tripRef.current = trip;

  const nearest = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return null;
    return nearestBorder({ lat: geo.lat, lng: geo.lng }, BORDER_POINTS);
  }, [geo.lat, geo.lng]);

  const nearestLine = useMemo(() => {
    if (geo.lat === null || geo.lng === null) return null;
    return distanceToBorderLine({ lat: geo.lat, lng: geo.lng }, BORDER_LINES);
  }, [geo.lat, geo.lng]);

  const nearGate = !!trip && nearest !== null && nearest.distanceKm < BORDER_RADIUS_KM;
  const nearLine = !!trip && nearestLine !== null && nearestLine.distanceKm < BORDER_LINE_ALERT_KM;
  const nearBorder = nearGate || nearLine;
  const dangerKey = nearLine && nearestLine ? `line:${nearestLine.lineId}` : nearGate && nearest ? `gate:${nearest.border.id}` : null;

  useEffect(() => {
    if (nearBorder && dangerKey && borderAlertedFor !== dangerKey) {
      setBorderAlertedFor(dangerKey);
      if (dangerKey.startsWith('line:') && nearestLine) {
        onBorderAlarm(`Cách ĐƯỜNG BIÊN GIỚI (${nearestLine.lineName}) chỉ ${formatKm(nearestLine.distanceKm)} — vùng có đường mòn/lối mở qua biên giới`);
      } else if (nearest) {
        onBorderAlarm(nearest.border.name);
      }
    }
    if (!nearBorder) setBorderAlertedFor(null);
  }, [nearBorder, dangerKey, nearest, nearestLine, borderAlertedFor, onBorderAlarm]);

  /* ------- community danger communes (v1.42): whole communes tinted by
   * their real boundary + an entry warning while travelling. Reports are
   * seeded from the localStorage cache, refreshed from the relay on mount
   * and every 5 minutes; each reported commune's boundary polygon is then
   * fetched once (OSM) and cached. The warning mirrors the border alarm:
   * latches per commune, re-arms on exit, vibrates once. */
  const [reports, setReports] = useState<DangerReport[]>(() => loadCachedReports());
  const [geometries, setGeometries] = useState<Record<string, ZoneGeometry | null>>({});
  const geomBusyRef = useRef<Set<string>>(new Set());
  const [zoneAlertedKey, setZoneAlertedKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => { void fetchDangerReports().then((r) => { if (alive) setReports(r); }); };
    refresh();
    const id = window.setInterval(refresh, 300000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const communes = useMemo(() => buildCommuneZones(reports), [reports]);

  useEffect(() => {
    for (const c of communes) {
      if (c.key in geometries || geomBusyRef.current.has(c.key)) continue;
      geomBusyRef.current.add(c.key);
      void fetchCommuneGeometry(c, c.centroid).then((g) => {
        setGeometries((prev) => ({ ...prev, [c.key]: g }));
      });
    }
  }, [communes, geometries]);

  const zones = useMemo<CommuneZone[]>(
    () => communes.map((c) => ({ ...c, geometry: geometries[c.key] ?? null })),
    [communes, geometries],
  );

  const zoneHit = useMemo(() => {
    if (!trip || geo.lat === null || geo.lng === null) return null;
    const la = geo.lat;
    const ln = geo.lng;
    return zones.find((z) => communeContains(z, la, ln)) ?? null;
  }, [trip, geo.lat, geo.lng, zones]);
  const insideZone = !!zoneHit;

  useEffect(() => {
    if (insideZone && zoneHit && zoneAlertedKey !== zoneHit.key) {
      setZoneAlertedKey(zoneHit.key);
      try { navigator.vibrate?.([300, 120, 300]); } catch { /* no vibrate */ }
    }
    if (!insideZone) setZoneAlertedKey(null);
  }, [insideZone, zoneHit, zoneAlertedKey]);

  const dms = useDeadMansSwitch(!!trip, onDeadManTimeout);
  const live = useLiveSmsUpdates(!!trip && !alarming, geo.lat, geo.lng);

  /* Server-side DMS watch (v1.34, on Cloudflare since v1.36): report the
   * check-in deadline to the push Worker, whose cron watcher Web-Pushes a
   * −5 min warning even after the traveler closes the web app — the
   * in-page countdown above dies with the page, the Worker's copy does
   * not. Sync on every arm / check-in (deadlineMs changes), clear on a
   * deliberate trip end, and re-assert every 5 minutes so a sync lost to
   * a dead zone heals itself (the Worker only resets its "warned" flag
   * when the deadline truly moves, so re-asserting the same value can
   * never cause a duplicate warning). 5 minutes is plenty for insurance
   * — every real change already syncs immediately — and it cuts the
   * Worker's request load fivefold versus the original 60s cadence.
   * No-op until PUSH_WORKER_URL is configured. */
  const dmsDeadlineMs = dms.deadlineMs;
  useEffect(() => {
    if (!isPushConfigured()) return;
    if (!trip) {
      const code = loadLiveSessionCode();
      if (code) void syncDmsDeadline(code, null);
      return;
    }
    const code = ensureLiveSession();
    const sync = () => { if (dmsDeadlineMs) void syncDmsDeadline(code, dmsDeadlineMs); };
    sync();
    const id = window.setInterval(sync, 300000);
    return () => window.clearInterval(id);
  }, [trip, dmsDeadlineMs]);

  /* ---------------- predicted route while setting up ---------------- */
  const gpsPoint: PlacePoint | null = geo.lat !== null && geo.lng !== null
    ? { lat: geo.lat, lng: geo.lng, name: 'Vị trí hiện tại' }
    : null;
  const effStart = startPick ?? gpsPoint;

  useEffect(() => {
    if (trip || !effStart || !destPick) return;
    // Recompute only when the destination changed, or the start moved
    // a meaningful distance from the point the route was computed for.
    const key = `${destPick.lat.toFixed(4)},${destPick.lng.toFixed(4)}`;
    const [pLat, pLng] = (routeKeyRef.current.split('|')[1] ?? ',').split(',').map(Number);
    const startMoved = !Number.isFinite(pLat) || haversineKm(effStart.lat, effStart.lng, pLat, pLng) > 0.5;
    if (routeKeyRef.current.startsWith(key) && !startMoved) return;
    if (routeBusyRef.current) return;
    routeBusyRef.current = true;
    setRouteBusy(true);
    const from = effStart;
    const to = destPick;
    const timer = window.setTimeout(() => {
      void fetchRoute(from, to).then((r) => {
        routeBusyRef.current = false;
        setRouteBusy(false);
        routeKeyRef.current = `${key}|${from.lat},${from.lng}`;
        if (r) { setRouteInfo(r); setRouteFailed(false); }
        else { setRouteInfo(null); setRouteFailed(true); }
      });
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, effStart?.lat, effStart?.lng, destPick]);

  /* ---------------- off-route / wrong-way watch during a trip -------- */
  useEffect(() => {
    const t = tripRef.current;
    if (!t?.route || t.destLat === undefined || t.destLng === undefined || geo.lat === null || geo.lng === null) return;
    const pos = { lat: geo.lat, lng: geo.lng };
    const prog = routeProgress(pos, t.route);
    setLiveRemainingKm(prog.remainingKm);
    // Trim the drawn line to what is still ahead (update only when the
    // head of the line actually advanced, to avoid re-render churn).
    const trimmed = remainingRoutePoints(pos, t.route);
    const prev = displayRouteRef.current;
    if (!prev || prev.length !== trimmed.length || haversineKm(prev[0][0], prev[0][1], trimmed[0][0], trimmed[0][1]) > 0.04) {
      displayRouteRef.current = trimmed;
      setDisplayRoute(trimmed);
    }
    const destKm = haversineKm(pos.lat, pos.lng, t.destLat, t.destLng);
    const now = Date.now();

    if (destKm < 0.4) { // basically arrived
      offSinceRef.current = null;
      samplesRef.current = [];
      if (devAlarmRef.current) setDevAlarm(null);
      return;
    }

    /* wrong way: destination keeps getting farther while moving */
    const samples = samplesRef.current;
    samples.push({ t: now, destKm });
    while (samples.length > 0 && now - samples[0].t > WRONGWAY_WINDOW_MS) samples.shift();
    const first = samples[0];
    const goingWrong = !!first && now - first.t >= WRONGWAY_MIN_SPAN_MS && destKm - first.destKm > WRONGWAY_GAIN_KM;
    if (goingWrong && devAlarmRef.current?.kind !== 'wrong') {
      setDevAlarm({ kind: 'wrong', offKm: prog.offKm });
      try { navigator.vibrate?.([300, 120, 300]); } catch { /* no vibrate */ }
    } else if (!goingWrong && devAlarmRef.current?.kind === 'wrong' && prog.offKm <= OFF_ALARM_KM) {
      setDevAlarm(null);
    }

    /* off route: big miss, sustained */
    if (prog.offKm > OFF_ALARM_KM) {
      if (offSinceRef.current === null) offSinceRef.current = now;
      if (now - offSinceRef.current >= OFF_ALARM_MS && devAlarmRef.current?.kind !== 'off') {
        setDevAlarm({ kind: 'off', offKm: prog.offKm });
        try { navigator.vibrate?.([300, 120, 300]); } catch { /* no vibrate */ }
      }
    } else if (prog.offKm <= OFF_OK_KM) {
      offSinceRef.current = null;
      if (devAlarmRef.current?.kind === 'off') setDevAlarm(null);
    }

    /* quiet reroute: redraw the prediction from where the driver is now */
    if (prog.offKm > OFF_OK_KM && now - lastRerouteRef.current > REROUTE_COOLDOWN_MS) {
      lastRerouteRef.current = now;
      const dest: PlacePoint = { lat: t.destLat, lng: t.destLng, name: t.destination };
      void fetchRoute({ lat: pos.lat, lng: pos.lng, name: 'Vị trí hiện tại' }, dest).then((r) => {
        const cur = tripRef.current;
        if (!r || !cur?.route) return;
        const check = routeProgress(pos, r.points);
        if (check.offKm <= OFF_OK_KM + 0.4) {
          const nt: TripConfig = { ...cur, route: r.points, distanceKm: r.distanceKm, durationMin: r.durationMin };
          setTrip(nt);
          saveTrip(nt);
          offSinceRef.current = null;
          if (devAlarmRef.current) setDevAlarm(null);
          setRerouteNote('Đã vẽ lại tuyến theo đường bạn đang đi');
          window.setTimeout(() => setRerouteNote(''), 6000);
        }
      });
    }
  }, [geo.lat, geo.lng]);

  const start = () => {
    if (!destPick) return;
    const t: TripConfig = {
      destination: destPick.name,
      hours: routeInfo ? Math.max(1, Math.ceil(routeInfo.durationMin / 60)) : 5,
      startedAt: Date.now(),
      destLat: destPick.lat,
      destLng: destPick.lng,
      startName: effStart?.name,
      startLat: effStart?.lat,
      startLng: effStart?.lng,
      route: routeInfo?.points,
      distanceKm: routeInfo?.distanceKm,
      durationMin: routeInfo?.durationMin,
    };
    setTrip(t); saveTrip(t); geo.startWatch();
    setDevAlarm(null);
    offSinceRef.current = null;
    samplesRef.current = [];
    lastRerouteRef.current = 0;
  };
  const stop = () => {
    setTrip(null); saveTrip(null); geo.stopWatch();
    setDevAlarm(null);
    setLiveRemainingKm(null);
    setDisplayRoute(null);
    displayRouteRef.current = null;
    offSinceRef.current = null;
    samplesRef.current = [];
  };

  const mapRoute = trip ? (displayRoute ?? trip.route) : routeInfo?.points;
  /** Follow the driver with the camera while travelling (or when no
   * preview route is on screen); in setup-preview the map instead
   * frames the whole suggested route. */
  const followUser = !!trip || !routeInfo;
  const mapDest: PlacePoint | null = trip
    ? (trip.destLat !== undefined && trip.destLng !== undefined ? { lat: trip.destLat, lng: trip.destLng, name: trip.destination } : null)
    : destPick;
  const plannedEta = trip?.durationMin ? trip.startedAt + trip.durationMin * 60000 : null;

  return (
    <>
    <LiveUpdateBanner visible={!!live.prompt} onSend={live.sendUpdate} onDismiss={live.dismiss} />
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] items-start">
      <div className="space-y-3 min-w-0">
        <MapView lat={geo.lat} lng={geo.lng} route={mapRoute ?? null} dest={mapDest} followUser={followUser} zones={zones} />
        {nearest && nearestLine && (
          <div className={`grid grid-cols-2 gap-2 ${nearBorder ? '' : ''}`}>
            <div className={`rounded-3xl p-3.5 border text-center ${nearLine ? 'bg-red-500/15 border-red-500' : 'bg-panel border-slate-700/60'}`}>
              <p className="text-xs text-slate-400 font-bold">🚩 TỚI BIÊN GIỚI</p>
              <p className={`text-2xl font-black ${nearLine ? 'text-red-400' : 'text-white'}`}>{formatKm(nearestLine.distanceKm)}</p>
            </div>
            <div className={`rounded-3xl p-3.5 border text-center ${nearGate ? 'bg-red-500/15 border-red-500' : 'bg-panel border-slate-700/60'}`}>
              <p className="text-xs text-slate-400 font-bold">🏁 TỚI CỬA KHẨU GẦN NHẤT</p>
              <p className={`text-2xl font-black ${nearGate ? 'text-red-400' : 'text-white'}`}>{formatKm(nearest.distanceKm)}</p>
              <p className="text-[11px] text-slate-400 truncate">{nearest.border.name}</p>
            </div>
          </div>
        )}
        {nearBorder && (
          <div className="bg-red-600 text-white rounded-3xl p-3.5 font-black text-center text-base">
            <TriangleAlert className="inline w-5 h-5 mr-1 -mt-1" />
            {nearLine ? 'QUÁ GẦN BIÊN GIỚI — HÃY CẢNH GIÁC!' : 'ĐANG Ở GẦN CỬA KHẨU BIÊN GIỚI!'}
          </div>
        )}
        {devAlarm && (
          <div className="bg-red-600 text-white rounded-3xl p-3.5 font-black text-center text-base animate-pulse">
            <TriangleAlert className="inline w-5 h-5 mr-1 -mt-1" />
            {devAlarm.kind === 'wrong'
              ? 'ĐANG ĐI NGƯỢC HƯỚNG ĐÍCH — NGÀY CÀNG XA NƠI CẦN ĐẾN!'
              : `ĐANG ĐI CHỆCH TUYẾN ĐƯỜNG DỰ ĐOÁN ${formatKm(devAlarm.offKm)}!`}
          </div>
        )}
        {insideZone && zoneHit && (
          <div className="bg-red-600 text-white rounded-3xl p-3.5 font-black text-center text-base animate-pulse">
            <TriangleAlert className="inline w-5 h-5 mr-1 -mt-1" />
            BẠN ĐANG Ở {zoneHit.wardName.toUpperCase()} — KHU VỰC CÓ BÁO NGUY HIỂM: {ZONE_TYPE_META[zoneHit.topType].label.toUpperCase()}!
            <span className="block text-sm font-bold mt-0.5">{(zoneHit.reports.find((r) => r.type === zoneHit.topType) ?? zoneHit.reports[0]).description}</span>
            {zoneHit.reports.length > 1 && (
              <span className="block text-xs font-bold mt-0.5">+{zoneHit.reports.length - 1} báo cáo khác — chạm vào vùng tô màu trên bản đồ để xem hết</span>
            )}
          </div>
        )}
        {rerouteNote && !devAlarm && (
          <div className="bg-sky-600/90 text-white rounded-3xl p-3 font-bold text-center text-sm">
            {rerouteNote}
          </div>
        )}
      </div>

      <div>
        {!trip ? (
          <section className="bg-panel rounded-3xl p-4 border border-slate-700/60 space-y-4">
            <PlacePicker
              label="📍 Điểm bắt đầu"
              value={startPick}
              onChange={setStartPick}
              allowCurrent
              currentPos={geo.lat !== null && geo.lng !== null ? { lat: geo.lat, lng: geo.lng } : null}
            />
            {!startPick && (
              <p className="text-[11px] text-slate-500 -mt-2">Không chọn gì thì app lấy vị trí hiện tại của bạn làm điểm bắt đầu.</p>
            )}
            <PlacePicker label="🏁 Bạn đi đâu?" value={destPick} onChange={setDestPick} />

            {destPick && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-center">
                {routeBusy ? (
                  <p className="text-sm text-slate-300 font-bold">⏳ Đang tính đường đi…</p>
                ) : routeInfo ? (
                  <>
                    <p className="text-base font-black text-white">🛣 {formatKm(routeInfo.distanceKm)} · đi khoảng {fmtDuration(routeInfo.durationMin)}</p>
                    <p className="text-sm text-emerald-300 font-bold mt-0.5">Đến nơi khoảng {fmtClock(Date.now() + routeInfo.durationMin * 60000)}</p>
                  </>
                ) : (
                  <p className="text-xs text-amber-300 font-bold">Chưa tính được đường đi (mạng yếu?). Vẫn bắt đầu được — app canh biên giới như cũ, chỉ thiếu cảnh báo lệch tuyến.</p>
                )}
              </div>
            )}
            {!destPick && <p className="text-xs text-slate-400 text-center">Chọn điểm đến chi tiết ở trên — app tự tính đường đi và giờ đến nơi, khỏi nhập tay.</p>}

            <button onClick={start} disabled={!destPick} className="w-full bg-success hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-white text-lg font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition">
              <Play className="w-6 h-6" /> BẮT ĐẦU ĐI
            </button>
            <p className="text-xs text-slate-400 text-center">App tự canh: gần biên giới là báo ngay, đi chệch tuyến xa là báo.</p>
          </section>
        ) : (
          <section className="bg-panel rounded-3xl p-4 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-black text-white text-base flex items-center gap-1.5 min-w-0"><Flag className="w-5 h-5 text-emerald-400 shrink-0" /><span className="truncate">Đang đi: {trip.destination}</span></h3>
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full font-bold shrink-0">● ĐANG CANH</span>
            </div>

            {trip.route && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-center">
                <p className="text-sm font-bold text-slate-200">
                  {liveRemainingKm !== null ? <>Còn khoảng <b className="text-white">{formatKm(liveRemainingKm)}</b> theo tuyến</> : 'Đang theo tuyến đường dự đoán'}
                  {plannedEta && <> · đến nơi khoảng <b className="text-emerald-300">{fmtClock(plannedEta)}</b></>}
                </p>
              </div>
            )}

            <div className={`rounded-3xl p-4 text-center border ${dms.inGrace ? 'bg-red-500/15 border-red-500' : 'bg-slate-900 border-slate-700'}`}>
              <p className="text-sm font-bold text-slate-300">{dms.inGrace ? '⚠️ BẤM NGAY NÚT XANH Ở DƯỚI!' : 'Còn từng này phải điểm danh:'}</p>
              <p className={`text-4xl font-black tabular-nums my-1 ${dms.inGrace ? 'text-red-400' : 'text-white'}`}>{formatCountdown(dms.inGrace ? dms.graceLeft : dms.secondsLeft)}</p>
              {dms.inGrace && <p className="text-xs text-red-300 font-bold">Không bấm = còi kêu to + mở sẵn tin SOS</p>}
              <motion.button whileTap={{ scale: 0.97 }} onClick={dms.checkIn} className="mt-2 w-full bg-success text-white text-lg font-black py-3.5 rounded-2xl flex items-center justify-center gap-2">
                <ShieldCheck className="w-6 h-6" /> TÔI AN TOÀN
              </motion.button>
            </div>

            <button onClick={stop} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
              <Square className="w-4 h-4" /> Đã tới nơi — tắt canh
            </button>
            {alarming && <p className="text-center text-red-400 text-sm font-bold animate-blink-red">ĐANG KÊU CÒI — sang tab SOS để tắt</p>}
          </section>
        )}
        <div className="mt-4">
          <PushNotifyCard />
        </div>
        <div className="mt-4">
          <LivePanel onOpenLive={onOpenLive} />
        </div>
        <div className="mt-4">
          <DangerZoneCard lat={geo.lat} lng={geo.lng} zones={zones} />
        </div>
      </div>
    </div>
    </>
  );
}

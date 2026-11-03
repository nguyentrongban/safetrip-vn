import { useCallback, useEffect, useRef, useState } from 'react';
import { beep, vibrate } from '../utils/audio';

export const CHECKIN_INTERVAL_SEC = 30 * 60;
export const GRACE_SEC = 3 * 60;

/** localStorage key holding the persisted DMS cycle. The ABSOLUTE deadline
 * is the single source of truth: it survives page freeze/kill/reload, so
 * the countdown can neither pause (frozen page) nor reset to 30:00 (reload
 * used to re-arm a fresh deadline and overwrite the relay's correct one). */
const STORAGE_KEY = 'safetrip_dms';

interface DmsCycle {
  deadlineMs: number;
  /** True once this cycle's timeout has fired — persisted so a reload can
   * never fire the same cycle twice, nor silently re-arm a new one. The
   * record is only replaced by checkIn() or removed when the switch is
   * disabled (trip ended deliberately). */
  fired: boolean;
}

function loadCycle(): DmsCycle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DmsCycle>;
    if (typeof parsed.deadlineMs !== 'number' || !Number.isFinite(parsed.deadlineMs)) return null;
    return { deadlineMs: parsed.deadlineMs, fired: parsed.fired === true };
  } catch { return null; }
}

function saveCycle(cycle: DmsCycle | null): void {
  try {
    if (cycle) localStorage.setItem(STORAGE_KEY, JSON.stringify(cycle));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable — in-memory cycle still works this session */ }
}

type Phase = 'count' | 'grace' | 'overdue';

function phaseAt(cycle: DmsCycle, now: number): Phase {
  if (now < cycle.deadlineMs) return 'count';
  if (now < cycle.deadlineMs + GRACE_SEC * 1000) return 'grace';
  return 'overdue';
}

/**
 * Dead Man's Switch anchored to an absolute deadline (epoch ms).
 * deadlineMs is set ONLY when a cycle arms (switch enabled with no stored
 * cycle) and at checkIn(). Everything displayed is derived from the clock
 * on each 1s tick and on visibilitychange/focus, so a page frozen for 10
 * minutes shows the true remaining time the moment it wakes, and a reload
 * restores the stored deadline instead of starting over. If the deadline
 * (+ grace) already passed while the page was dead, onTimeout() fires
 * exactly once on restore — same as the grace expiring live.
 */
export function useDeadMansSwitch(enabled: boolean, onTimeout: () => void) {
  // Lazy restore: if the switch is on and a cycle was persisted, the very
  // first render already carries the true deadline — no 30:00 flash and no
  // wrong value for MonitorTab's relay sync to mirror.
  const [cycle, setCycle] = useState<DmsCycle | null>(() => (enabled ? loadCycle() : null));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const cbRef = useRef(onTimeout);
  cbRef.current = onTimeout;
  const cycleRef = useRef(cycle);
  cycleRef.current = cycle;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const phaseRef = useRef<Phase | null>(null);

  // Persist every cycle change (arm / fire / clear).
  useEffect(() => { saveCycle(cycle); }, [cycle]);

  // Arm or clear on the enabled edge. A stored/existing cycle is NEVER
  // re-armed by a mere mount or remount — only by checkIn().
  useEffect(() => {
    if (!enabled) {
      phaseRef.current = null;
      setCycle((c) => (c === null ? c : null));
      return;
    }
    setCycle((c) => {
      if (c) return c;
      const stored = loadCycle();
      if (stored) return stored;
      return { deadlineMs: Date.now() + CHECKIN_INTERVAL_SEC * 1000, fired: false };
    });
  }, [enabled]);

  const checkIn = useCallback(() => {
    phaseRef.current = 'count';
    setCycle({ deadlineMs: Date.now() + CHECKIN_INTERVAL_SEC * 1000, fired: false });
    vibrate(60);
  }, []);

  // Clock-driven evaluation: derive the phase from the absolute deadline,
  // beep on grace entry and per-second inside grace, fire exactly once
  // when the deadline + grace has passed (live or discovered on wake).
  const evaluate = useCallback(() => {
    const now = Date.now();
    setNowMs(now);
    const c = cycleRef.current;
    if (!enabledRef.current || !c) return;
    const phase = phaseAt(c, now);
    const prev = phaseRef.current;
    if (phase === 'grace') {
      if (prev !== 'grace') { beep(5, 1200, 200); vibrate([400, 150, 400, 150, 400]); }
      else { beep(1, 1200, 120); vibrate([200, 100, 200]); }
    } else if (phase === 'overdue' && !c.fired) {
      const firedCycle = { ...c, fired: true };
      cycleRef.current = firedCycle;
      setCycle(firedCycle);
      cbRef.current();
    }
    phaseRef.current = phase;
  }, []);

  useEffect(() => {
    if (!enabled || !cycle) return;
    evaluate();
    const id = window.setInterval(evaluate, 1000);
    const onWake = () => evaluate();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [enabled, cycle, evaluate]);

  // Display values derived from the clock — never decremented blindly.
  let secondsLeft = CHECKIN_INTERVAL_SEC;
  let inGrace = false;
  let graceLeft = GRACE_SEC;
  if (enabled && cycle) {
    const remainingMs = cycle.deadlineMs - nowMs;
    if (remainingMs > 0) {
      secondsLeft = Math.ceil(remainingMs / 1000);
    } else {
      inGrace = true;
      secondsLeft = 0;
      graceLeft = Math.max(0, Math.ceil((cycle.deadlineMs + GRACE_SEC * 1000 - nowMs) / 1000));
    }
  }

  return { secondsLeft, inGrace, graceLeft, checkIn, deadlineMs: cycle ? cycle.deadlineMs : null };
}

export function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60); const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

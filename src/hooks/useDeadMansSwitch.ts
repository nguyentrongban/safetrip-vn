import { useCallback, useEffect, useRef, useState } from 'react';
import { beep, vibrate } from '../utils/audio';

export const CHECKIN_INTERVAL_SEC = 30 * 60;
export const GRACE_SEC = 3 * 60;

/**
 * Dead Man's Switch: counts down CHECKIN_INTERVAL_SEC.
 * At 0 -> beep + vibrate continuously, starts GRACE_SEC grace countdown.
 * If grace expires without checkIn() -> onTimeout() fires exactly once per cycle.
 */
export function useDeadMansSwitch(enabled: boolean, onTimeout: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(CHECKIN_INTERVAL_SEC);
  const [inGrace, setInGrace] = useState(false);
  const [graceLeft, setGraceLeft] = useState(GRACE_SEC);
  const firedRef = useRef(false);
  const cbRef = useRef(onTimeout);
  cbRef.current = onTimeout;

  const checkIn = useCallback(() => {
    setSecondsLeft(CHECKIN_INTERVAL_SEC); setInGrace(false); setGraceLeft(GRACE_SEC); firedRef.current = false;
    vibrate(60);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (inGrace) {
        setGraceLeft((g) => {
          if (g <= 1) {
            if (!firedRef.current) { firedRef.current = true; cbRef.current(); }
            return 0;
          }
          beep(1, 1200, 120); vibrate([200, 100, 200]);
          return g - 1;
        });
      } else {
        setSecondsLeft((s) => {
          if (s <= 1) { setInGrace(true); setGraceLeft(GRACE_SEC); beep(5, 1200, 200); vibrate([400, 150, 400, 150, 400]); return 0; }
          return s - 1;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, inGrace]);

  return { secondsLeft, inGrace, graceLeft, checkIn };
}

export function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60); const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

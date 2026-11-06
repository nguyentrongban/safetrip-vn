import { useCallback, useRef, useState } from 'react';
import { startSiren, stopSiren, vibrate } from '../utils/audio';
import { buildSmsUrl, buildSosBody, loadSOS } from '../utils/storage';

/** Central emergency trigger shared by SOS button, border alert and Dead Man's Switch. */
export function useAlarm() {
  const [alarming, setAlarming] = useState(false);
  const [lastTrigger, setLastTrigger] = useState('');
  const openedRef = useRef(false);

  const triggerSOS = useCallback((reason: string, lat: number | null, lng: number | null, openSms = true, silent = false) => {
    setAlarming(true); setLastTrigger(reason);
    // Silent mode (voice-triggered SOS, v1.79): no siren, no vibration —
    // a victim who activated by voice must not be betrayed by the phone.
    if (!silent) { startSiren(); vibrate([500, 200, 500, 200, 500]); }
    const cfg = loadSOS();
    const phone = cfg.phone1 || cfg.phone2;
    if (openSms && phone && !openedRef.current) {
      openedRef.current = true;
      window.location.href = buildSmsUrl(phone, buildSosBody(cfg, lat, lng));
      window.setTimeout(() => { openedRef.current = false; }, 8000);
    }
  }, []);

  const stopAlarm = useCallback(() => { setAlarming(false); stopSiren(); vibrate(40); }, []);

  return { alarming, lastTrigger, triggerSOS, stopAlarm };
}

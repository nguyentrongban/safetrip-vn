let ctx: AudioContext | null = null;
let sirenTimer: number | null = null;
let osc: OscillatorNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Police-style siren sweeping 800Hz <-> 1200Hz. Call stopAlarm() to silence. */
export function startSiren(): void {
  stopSiren();
  const ac = getCtx();
  osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  gain.gain.value = 0.22;
  osc.connect(gain); gain.connect(ac.destination);
  let high = false;
  const sweep = () => { if (osc) osc.frequency.setValueAtTime(high ? 1200 : 800, ac.currentTime); high = !high; };
  sweep(); osc.start();
  sirenTimer = window.setInterval(sweep, 420);
}
export function stopSiren(): void {
  if (sirenTimer !== null) { clearInterval(sirenTimer); sirenTimer = null; }
  if (osc) { try { osc.stop(); } catch { /* already stopped */ } osc.disconnect(); osc = null; }
}
export function beep(times = 3, freq = 990, ms = 180): void {
  const ac = getCtx();
  let i = 0;
  const play = () => {
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0.25;
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + ms / 1000);
    i++; if (i < times) window.setTimeout(play, ms + 120);
  };
  play();
}
export function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

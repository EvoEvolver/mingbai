// Sound engine: Web Audio synthesis (no sample files). The AudioContext is created only on first playback (a user click), as browser autoplay policy requires.
// One instance shared across the site; settings (volume/mute/timbre/tuning) are stored in localStorage.
import { useEffect, useState } from "react";
import { freq } from "./theory.js";

const KEY = "book-audio";
const DEFAULTS = { volume: 0.7, muted: false, timbre: "piano", tuning: "equal", view: "staff" };   // view: show scores as staff notation (staff) or piano roll (roll)
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } };

let ctx = null, master = null, waves = {};
let settings = typeof localStorage === "undefined" ? { ...DEFAULTS } : load();
const voices = new Set();          // nodes currently sounding
const timers = new Set();          // scheduled UI callbacks
const active = new Map();          // midi → count of simultaneous voices (for highlighting)
const subs = new Set();            // subscribers: active / settings changes
const stopSubs = new Set();        // notifies playback components on stop() so they can reset their UI
const emit = () => subs.forEach(f => f());

// Timbres: harmonic amplitude table → PeriodicWave
const TIMBRES = {
  // bright / brightEnd: low-pass cutoff as a multiple of the fundamental (tracks pitch, so high notes aren't harsher), capped at maxHz
  piano: { harm: [1, 0.42, 0.2, 0.1, 0.05, 0.025, 0.012], attack: 0.008, decay: 1.6, sustain: 0, release: 0.28, bright: 7, brightEnd: 2.2, maxHz: 4200 },
  organ: { harm: [1, 0.6, 0.35, 0.15, 0.18, 0, 0.08, 0.06], attack: 0.02, decay: 0.1, sustain: 0.75, release: 0.12, bright: 8, brightEnd: 8, maxHz: 4000 },
  sine: { harm: [1], attack: 0.015, decay: 0.2, sustain: 0.8, release: 0.15, bright: 60, brightEnd: 60, maxHz: 20000 },
};

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
    for (const [k, t] of Object.entries(TIMBRES)) {
      const real = new Float32Array(t.harm.length + 1), imag = new Float32Array(t.harm.length + 1);
      t.harm.forEach((a, i) => (imag[i + 1] = a));
      waves[k] = ctx.createPeriodicWave(real, imag);
    }
  }
  if (ctx.state === "suspended") ctx.resume();
  master.gain.value = settings.muted ? 0 : settings.volume;
  return ctx;
}

// Schedule a UI callback (cancelled together with stop())
export function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms)); timers.add(t); }
const mark = (midi, d) => { const n = (active.get(midi) || 0) + d; n > 0 ? active.set(midi, n) : active.delete(midi); emit(); };

// Play one note. at: seconds from now; dur: duration (seconds); ref: reference note for just intonation
function voice(midi, at, dur, { velocity = 0.8, ref = 60, tuning = settings.tuning, timbre = settings.timbre, gain } = {}) {
  const T = TIMBRES[timbre] || TIMBRES.piano, t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  osc.setPeriodicWave(waves[timbre] || waves.piano);
  const f = freq(midi, tuning, ref); osc.frequency.value = f;
  lp.type = "lowpass"; lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(Math.min(T.maxHz, f * T.bright), t0);
  lp.frequency.exponentialRampToValueAtTime(Math.min(T.maxHz, Math.max(f * T.brightEnd, 300)), t0 + T.decay + 0.01);
  const peak = 0.22 * velocity * (gain ?? 1), sus = Math.max(peak * T.sustain, 0.0001), end = t0 + dur;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + T.attack);
  g.gain.exponentialRampToValueAtTime(sus, t0 + T.attack + T.decay);
  g.gain.setValueAtTime(sus, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + T.release);
  osc.connect(lp).connect(g).connect(master);
  osc.start(t0); osc.stop(end + T.release + 0.05);
  voices.add(osc); osc.onended = () => voices.delete(osc);
  later(() => mark(midi, 1), at * 1000);
  later(() => mark(midi, -1), (at + dur) * 1000);
}

// Play a group of notes. arp: arpeggio interval (seconds, 0 = simultaneous)
// The more notes sound together, the quieter each one (÷√n), so a chord is about as loud as a single note and doesn't overload the compressor
export function play(notes, { dur = 1.4, arp = 0, at = 0, ...o } = {}) {
  ensure();
  const ns = [].concat(notes), gain = o.gain ?? 1 / Math.sqrt(Math.max(1, ns.length) / 1.5 > 1 ? ns.length / 1.5 : 1);
  ns.forEach((m, i) => voice(m, at + i * arp, dur - i * arp > 0.3 ? dur - i * arp : 0.3, { ...o, gain }));
}

// Play several steps in sequence: steps = [{ notes:[midi], dur?, arp? }]; onStep(i) is called at the start of each step (i = -1 means finished)
export function sequence(steps, { gap = 0.75, onStep, ...o } = {}) {
  ensure();
  let t = 0;
  steps.forEach((s, i) => {
    const d = s.dur ?? gap;
    play(s.notes, { ...o, ...s, at: t, dur: s.hold ?? Math.max(d * 1.15, 0.35) });
    if (onStep) later(() => onStep(i), t * 1000);
    t += d;
  });
  if (onStep) later(() => onStep(-1), t * 1000 + 150);
  return t;
}

// Stop all sound and scheduled callbacks
export function stop() {
  timers.forEach(clearTimeout); timers.clear();
  voices.forEach(v => { try { v.stop(); } catch { /* already stopped */ } }); voices.clear();
  active.clear(); emit();
  stopSubs.forEach(f => f());
}
// Subscribe to "stop all" (e.g. SoundBar's ■); returns an unsubscribe function; components use it to reset their playback state
export const onStop = f => (stopSubs.add(f), () => stopSubs.delete(f));

export const getSettings = () => settings;
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private browsing */ }
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
  emit();
}

// React: subscribe to the currently sounding notes (Set<midi>) and settings
export function useAudioState() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return { active: new Set(active.keys()), settings };
}

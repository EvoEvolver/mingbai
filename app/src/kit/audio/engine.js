// 声音引擎：Web Audio 合成（无采样文件）。AudioContext 在第一次播放（用户点击）时才创建，符合浏览器自动播放策略。
// 全站共享一个实例；设置（音量/静音/音色/律制）存 localStorage。
import { useEffect, useState } from "react";
import { freq } from "./theory.js";

const KEY = "book-audio";
const DEFAULTS = { volume: 0.7, muted: false, timbre: "piano", tuning: "equal" };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } };

let ctx = null, master = null, waves = {};
let settings = typeof localStorage === "undefined" ? { ...DEFAULTS } : load();
const voices = new Set();          // 正在发声的节点
const timers = new Set();          // 已排程的 UI 回调
const active = new Map();          // midi → 同时发声计数（供高亮）
const subs = new Set();            // 订阅者：active / settings 变化
const emit = () => subs.forEach(f => f());

// 音色：谐波振幅表 → PeriodicWave
const TIMBRES = {
  piano: { harm: [1, 0.55, 0.32, 0.18, 0.1, 0.06, 0.035, 0.02], attack: 0.004, decay: 1.6, sustain: 0, release: 0.25, bright: 5200, brightEnd: 900 },
  organ: { harm: [1, 0.7, 0.45, 0.2, 0.25, 0, 0.12, 0.1], attack: 0.02, decay: 0.1, sustain: 0.75, release: 0.12, bright: 4500, brightEnd: 4500 },
  sine: { harm: [1], attack: 0.015, decay: 0.2, sustain: 0.8, release: 0.15, bright: 20000, brightEnd: 20000 },
};
export const TIMBRE_LABELS = { piano: "钢琴", organ: "风琴", sine: "正弦" };

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

function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, Math.max(0, ms)); timers.add(t); }
const mark = (midi, d) => { const n = (active.get(midi) || 0) + d; n > 0 ? active.set(midi, n) : active.delete(midi); emit(); };

// 播放一个音。at：相对现在的秒数；dur：时值（秒）；ref：纯律参照音
function voice(midi, at, dur, { velocity = 0.8, ref = 60, tuning = settings.tuning, timbre = settings.timbre } = {}) {
  const T = TIMBRES[timbre] || TIMBRES.piano, t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  osc.setPeriodicWave(waves[timbre] || waves.piano);
  osc.frequency.value = freq(midi, tuning, ref);
  lp.type = "lowpass"; lp.frequency.setValueAtTime(T.bright, t0);
  lp.frequency.exponentialRampToValueAtTime(T.brightEnd, t0 + T.decay + 0.01);
  const peak = 0.22 * velocity, sus = Math.max(peak * T.sustain, 0.0001), end = t0 + dur;
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

// 播放一组音。arp：琶音间隔（秒，0 为同时）
export function play(notes, { dur = 1.4, arp = 0, at = 0, ...o } = {}) {
  ensure();
  [].concat(notes).forEach((m, i) => voice(m, at + i * arp, dur - i * arp > 0.3 ? dur - i * arp : 0.3, o));
}

// 依次播放若干步：steps = [{ notes:[midi], dur?, arp? }]；onStep(i) 在每步开始时回调（i = -1 表示结束）
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

// 停止一切声音与排程
export function stop() {
  timers.forEach(clearTimeout); timers.clear();
  voices.forEach(v => { try { v.stop(); } catch { /* 已停止 */ } }); voices.clear();
  active.clear(); emit();
}

export const getSettings = () => settings;
export function setSettings(patch) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 隐私模式 */ }
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
  emit();
}

// React：订阅当前发声的音（Set<midi>）与设置
export function useAudioState() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return { active: new Set(active.keys()), settings };
}

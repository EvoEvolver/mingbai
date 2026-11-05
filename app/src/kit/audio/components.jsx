import { t, lang } from "../i18n/index.js";
// Audible, interactive music components. See spec/AUDIO.md
import { useEffect, useMemo, useRef, useState } from "react";
import { play, sequence, stop, onStop, setSettings, useAudioState } from "./engine.js";
import { parseNote, parseNotes, parseChord, triadCore, pcName, isBlack, mod12, cycle, cycleCount, intervalName, tonnetzPc, triadName } from "./theory.js";
import "./audio.css";

// Normalize notes / chord / seq into playback steps
// Note name with octave, e.g. C4, Bb3, F#5. Accepts only octaves 0–5: G7, C6, G9, G13, etc. are always treated as chords (in harmony books they almost always are)
const NOTE_RE = /^[A-G][#♯b♭x]*-?[0-5]$/;
// Default chord register: root in F3–E4 (MIDI 53–64), close to the usual piano accompaniment register; an explicit octave is used as given
const chordNotes = (sym, octave) => {
  const c = parseChord(sym, octave ?? 4), shift = octave != null ? 0 : 53 + mod12(c.root - 53) - c.root;
  const ns = c.notes.map(n => n + shift); return c.bass != null ? [c.bass + shift, ...ns] : ns;
};
function toSteps({ notes, chord, seq, octave }) {
  // Each seq item: if made up entirely of "note names with octave", it's a group of notes ("C4 E4"), otherwise a chord symbol ("Am", "Bm7b5", "C/E")
  if (seq) return [].concat(seq).map(s => ({ notes: String(s).trim().split(/\s+/).every(t => NOTE_RE.test(t)) ? parseNotes(s) : chordNotes(s, octave) }));
  if (chord) return [{ notes: chordNotes(chord, octave) }];
  return [{ notes: parseNotes(notes) }];
}
// Reset hook: any stop() (including SoundBar's ■) calls fn
function useOnStop(fn) { const r = useRef(fn); r.current = fn; useEffect(() => onStop(() => r.current()), []); }

// ▶ Inline play button. <Play chord="C">C chord</Play>, <Play notes="C4 G4">perfect fifth</Play>, <Play seq={["C","Am","F","G"]} gap={0.9}/>
// arp: arpeggio interval in seconds (for a single chord); melodic: plays notes one at a time
export function Play({ notes, chord, seq, arp = 0, melodic, gap = 0.6, octave, children, title }) {
  const [on, setOn] = useState(false);
  useOnStop(() => setOn(false));
  const go = e => {
    e.stopPropagation();
    let steps = toSteps({ notes, chord, seq, octave });
    if (melodic) steps = steps[0].notes.map(n => ({ notes: [n] }));
    setOn(true);
    if (steps.length === 1) { play(steps[0].notes, { arp }); setTimeout(() => setOn(false), 1200); }
    else sequence(steps, { gap, arp, onStep: i => i < 0 && setOn(false) });
  };
  return <button className={"au-play" + (on ? " on" : "")} onClick={go} title={title || t("au.tryIt")}><i>{on ? "♪" : "▶"}</i>{children}</button>;
}

// Sound control bar fixed at the bottom right (place once per chapter). tuning=true shows the tuning switch
export function SoundBar({ tuning = false }) {
  const { settings: s, active } = useAudioState();
  return <div className="au-bar">
    <button onClick={() => setSettings({ muted: !s.muted })} title={s.muted ? t("au.unmute") : t("au.mute")}>{s.muted ? "🔇" : active.size ? "🔊" : "🔈"}</button>
    <input type="range" min="0" max="1" step="0.05" value={s.volume} onChange={e => setSettings({ volume: +e.target.value, muted: false })} aria-label={t("au.volume")} />
    <select value={s.timbre} onChange={e => setSettings({ timbre: e.target.value })} aria-label={t("au.timbreLabel")}>
      {Object.entries(t("au.timbre")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
    {tuning && <select value={s.tuning} onChange={e => setSettings({ tuning: e.target.value })} aria-label={t("au.tuning")}>
      <option value="equal">{t("au.equal")}</option><option value="just">{t("au.just")}</option></select>}
    <button onClick={stop} title={t("au.stop")}>■</button>
  </div>;
}

// Piano keyboard. highlight: notes to mark ("C4 E4 G4" / MIDI array); marks: {midi: label}; onNote(midi): click callback
export function Keyboard({ from = "C4", to = "B5", highlight = [], marks = {}, onNote, names = "white", height = 110, sound = true }) {
  const { active } = useAudioState();
  const lo = parseNote(from), hi = parseNote(to);
  const hl = new Set(typeof highlight === "string" ? parseNotes(highlight) : highlight);
  const whites = [], blacks = [];
  let x = 0;
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) blacks.push({ m, x: x - 7 }); else { whites.push({ m, x }); x += 24; }
  }
  const click = m => { if (sound) play([m], { dur: 1.1 }); onNote && onNote(m); };
  const cls = m => "au-key" + (active.has(m) ? " act" : "") + (hl.has(m) ? " hl" : "");
  return <svg className="au-kbd" viewBox={`-1 -1 ${x + 2} ${height + 2}`} style={{ maxWidth: x * 1.6 }}>
    {whites.map(({ m, x }) => <g key={m} onClick={() => click(m)}>
      <rect className={cls(m) + " w"} x={x} y={0} width={24} height={height} rx={3} />
      {(marks[m] || names === "all" || names === "white" || (names === "C" && m % 12 === 0)) &&
        <text x={x + 12} y={height - 9} className="au-kname">{marks[m] ?? pcName(m) + (m % 12 === 0 ? Math.floor(m / 12) - 1 : "")}</text>}
    </g>)}
    {blacks.map(({ m, x }) => <g key={m} onClick={() => click(m)}>
      <rect className={cls(m) + " b"} x={x} y={0} width={14} height={height * 0.62} rx={2} />
      {marks[m] && <text x={x + 7} y={height * 0.62 - 6} className="au-kname b">{marks[m]}</text>}
    </g>)}
  </svg>;
}

const CYCLE_COLORS = ["#9b2c1f", "#2c4a6e", "#3c6b4a", "#b8862b", "#5b3f7a", "#7a5b3f"];

// Twelve-tone cycle circle: pick a step → draws all cycles, which can be played; switches between "chromatic" and "circle of fifths" arrangements (animated)
// steps: optional step sizes; arrange: "chromatic" | "fifths"; lockArrange: hides the arrangement switch
export function PitchCircle({ step: step0 = 1, steps = [1, 2, 3, 4, 5, 6, 7], start: start0 = 0, arrange = "chromatic", lockArrange = false, size = 340 }) {
  const [step, setStep] = useState(step0), [start, setStart] = useState(start0);
  const [target, setTarget] = useState(arrange === "fifths" ? 1 : 0), [mix, setMix] = useState(target);
  const [cur, setCur] = useState(-1);
  useOnStop(() => setCur(-1));
  const { active } = useAudioState();
  const raf = useRef();
  useEffect(() => {   // Arrangement switch animation
    const from = mix, t0 = performance.now();
    const tick = t => { const k = Math.min(1, (t - t0) / 800), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setMix(from + (target - from) * e); if (k < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [target]); // eslint-disable-line
  const R = size / 2 - 34, C = size / 2;
  const pos = pc => {   // Linear interpolation between the positions of the two arrangements
    const a = i => (-90 + i * 30) * Math.PI / 180, p0 = a(pc), p1 = a(mod12(pc * 7));
    return [C + R * ((1 - mix) * Math.cos(p0) + mix * Math.cos(p1)), C + R * ((1 - mix) * Math.sin(p0) + mix * Math.sin(p1))];
  };
  const groups = useMemo(() => Array.from({ length: cycleCount(step) }, (_, g) => cycle(start + g, step)), [step, start]);
  const mine = groups[0];
  const activePc = new Set([...active].map(mod12));
  const playCycle = () => {
    stop();
    // Monotonically rising pitch: +step semitones each step, dropping an octave when above C6
    let m = 60 + mod12(start); const seq = [m]; for (let k = 1; k <= mine.length; k++) { m += step; if (m > 84) m -= 12; seq.push(m); }
    sequence(seq.map(n => ({ notes: [n] })), { gap: 0.42, onStep: i => setCur(i) });
  };
  const n = mine.length;
  return <div className="card au-circle">
    <div className="au-ctrl">
      <span className="au-lab">{t("au.stepLabel")}</span>
      {steps.map(s => <button key={s} className={s === step ? "on" : ""} onClick={() => { stop(); setCur(-1); setStep(s); }}>{s}<small>{t("au.stepName")[s]}</small></button>)}
    </div>
    <svg viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size * 1.25 }}>
      <circle cx={C} cy={C} r={R} className="au-ring" />
      {groups.map((g, gi) => {
        const pts = g.map(pos); const col = CYCLE_COLORS[gi % CYCLE_COLORS.length];
        return <g key={gi} opacity={gi === 0 ? 1 : 0.38}>
          {g.length > 1 && <polygon points={pts.map(p => p.join(",")).join(" ")} fill={g.length > 2 ? col + "14" : "none"} stroke={col} strokeWidth={gi === 0 ? 2.4 : 1.6} strokeLinejoin="round" />}
        </g>;
      })}
      {Array.from({ length: 12 }, (_, pc) => {
        const [x, y] = pos(pc), gi = groups.findIndex(g => g.includes(pc)), col = CYCLE_COLORS[gi % CYCLE_COLORS.length];
        const on = activePc.has(pc) || (cur >= 0 && mine[cur % n] === pc);
        return <g key={pc} className="au-node" onClick={() => { play([60 + pc], { dur: 1 }); setStart(pc); }}>
          <circle cx={x} cy={y} r={on ? 19 : 16} fill={on ? col : "var(--card)"} stroke={col} strokeWidth={pc === start ? 3 : 1.5} />
          <text x={x} y={y + 4} className={"au-nname" + (on ? " on" : "") + (isBlack(pc) ? " sm" : "")}>{pcName(pc, isBlack(pc) ? "sharp" : "both")}</text>
        </g>;
      })}
    </svg>
    <div className="au-info">
      <b>{t("au.perStep", step, t("au.stepName")[step])}</b>{t("au.route", pcName(start), n, n === 12 ? ((step === 1 || step === 11) === (target === 0) ? t("au.circle") : t("au.shape")[12]) : t("au.shape")[n] || t("au.polygon", n))}
      {t("au.cycles")}<b>{groups.length}</b>{t("au.cyclesTail", groups.length > 1)}
      <div className="au-seq">{mine.map((pc, k) => <span key={k} className={cur === k ? "on" : ""}>{pcName(pc)}</span>)}<span className={cur === n ? "on" : ""}>{pcName(mine[0])}</span></div>
    </div>
    <div className="au-ctrl">
      <button className="au-go" onClick={playCycle}>{t("au.playCycle")}</button>
      {!lockArrange && <>
        <button className={target === 0 ? "on" : ""} onClick={() => setTarget(0)}>{t("au.chromatic")}</button>
        <button className={target === 1 ? "on" : ""} onClick={() => setTarget(1)}>{t("au.fifths")}</button>
      </>}
      <span className="au-hint">{t("au.circleHint")}</span>
    </div>
  </div>;
}

// Interval workbench: click two notes on the keyboard (set in turn as lower and upper note); shows semitone count and interval name, with audition and inversion
export function IntervalLab({ from = "C4", to = "B5", lo: lo0 = "C4", hi: hi0 = "E4" }) {
  const [lo, setLo] = useState(parseNote(lo0)), [hi, setHi] = useState(parseNote(hi0)), [next, setNext] = useState(0);
  const st = hi - lo;
  const pick = m => { if (next === 0) { setLo(m); if (m >= hi) setHi(m + 4); setNext(1); } else { if (m > lo) setHi(m); else { setHi(lo); setLo(m); } setNext(0); } };
  const invert = () => { if (st <= 0) return; if (lo + 12 > hi) { setLo(hi); setHi(lo + 12); } else setLo(lo + 12); };
  return <div className="card au-ilab">
    <Keyboard from={from} to={to} onNote={pick} highlight={[lo, hi]} marks={{ [lo]: t("au.markRoot"), [hi]: t("au.markTop") }} names="C" />
    <div className="au-ireadout">
      <div><small>{t("au.rootTop")}</small><b>{pcName(lo)} → {pcName(hi)}</b></div>
      <div><small>{t("au.semitones")}</small><b>{st}</b></div>
      <div><small>{t("au.interval")}</small><b>{intervalName(st)}</b></div>
    </div>
    <div className="au-ctrl">
      <button className="au-go" onClick={() => play([lo, hi], { arp: 0.5, dur: 1.6 })}>{t("au.melodic")}</button>
      <button className="au-go" onClick={() => play([lo, hi], { dur: 1.6 })}>{t("au.harmonic")}</button>
      <button onClick={invert} disabled={st <= 0 || st > 12}>{t("au.invert")}</button>
      <span className="au-hint">{next === 0 ? t("au.pickRoot") : t("au.pickTop")}</span>
    </div>
    {st > 0 && st < 12 && <div className="au-note">{t("au.invertedIs")}<b>{intervalName(12 - st)}</b>{t("au.invertedSum", st, 12 - st)}</div>}
  </div>;
}

// Tonnetz grid (orientation and colors as in Illustrated Harmony: horizontal perfect fifths, upper right major thirds, upper left minor thirds; upward triangle = major triad (red), downward = minor triad (blue))
// highlight: ["C","Em"] chords to mark in advance; notes: set of pitch classes to mark (e.g. whole-tone scale [0,2,4,6,8,10])
// axes: which axis cycle lines to show ["fifths","M3","m3"]; center: center note; select: initially selected chord
// path: chord progression (e.g. ["C","Am","F","G"]), drawn as a route on the grid; current: which item is playing (driven by Progression); compact: hides the info bar below
export function Tonnetz({ cols = 11, rows = 6, center = "C", highlight = [], notes, axes = [], showAxesToggle = false, select, spell = "flat", unit = 62, caption, onChord, path, current = -1, compact = false }) {
  const { active } = useAudioState();
  const [ax, setAx] = useState(axes), [sel, setSel] = useState(select || null);
  const ci = Math.floor(cols / 2) - Math.floor(rows / 4), cj = Math.floor((rows - 1) / 2);
  const origin = mod12(parseNote(center) - (7 * ci + 4 * cj));
  const h = unit * Math.sqrt(3) / 2;
  const nodes = [], tris = [];
  for (let j = 0; j < rows; j++) {
    const i0 = -Math.floor(j / 2);
    for (let i = i0; i < i0 + cols; i++) nodes.push({ i, j, pc: tonnetzPc(i, j, origin), x: (i + j / 2) * unit, y: -j * h });
  }
  const at = (i, j) => nodes.find(n => n.i === i && n.j === j);
  for (const n of nodes) {
    const r = at(n.i + 1, n.j), u = at(n.i, n.j + 1), ur = at(n.i + 1, n.j + 1);
    if (r && u) tris.push({ key: `M${n.i},${n.j}`, minor: false, root: n.pc, pts: [n, r, u], pcs: [n.pc, r.pc, u.pc] });
    if (r && u && ur) tris.push({ key: `m${n.i},${n.j}`, minor: true, root: u.pc, pts: [r, u, ur], pcs: [u.pc, ur.pc, r.pc] });
  }
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), pad = 26;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  const hlParsed = highlight.map(sym => ({ sym, c: parseChord(sym) }));
  const hlSet = new Set(hlParsed.filter(h => triadCore(h.c)).map(h => (triadCore(h.c).minor ? "m" : "M") + mod12(h.c.root)));
  const hlName = Object.fromEntries(hlParsed.filter(h => triadCore(h.c)).map(h => [(triadCore(h.c).minor ? "m" : "M") + mod12(h.c.root), h.sym]));
  // Mark each highlighted chord only at the position closest to the grid center (a chord repeats periodically on the grid)
  const cx0 = (Math.min(...xs) + Math.max(...xs)) / 2, cy0 = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dist = t => ((t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3 - cx0) ** 2 + ((t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3 - cy0) ** 2;
  const hlKeys = new Set([...hlSet].map(k => tris.filter(t => (t.minor ? "m" : "M") + t.root === k).sort((a, b) => dist(a) - dist(b))[0]?.key));
  const activePc = new Set([...active].map(mod12)), notesSet = notes ? new Set(notes.map(mod12)) : null;
  const voicing = t => { const r = 53 + mod12(t.root - 53); return [r, r + (t.minor ? 3 : 4), r + 7]; };   // root in F3–E4
  const clickTri = t => { play(voicing(t), { arp: 0.04, dur: 1.6 }); setSel(t.key); onChord && onChord(triadName(t.root, t.minor, spell)); };
  const selT = tris.find(t => t.key === sel) || (select && tris.filter(t => (t.minor ? "m" : "M") + t.root === select).sort((a, b) => dist(a) - dist(b))[0]);
  // "Most compact" position of a set of pitch classes on the grid: start from each occurrence of the root, then each other note takes the intersection closest to the current centroid;
  // cost = spread within the set + distance from centroid to reference point (rx, ry) × w. So symmetric chords like diminished sevenths and augmented triads draw as a line or compact shape, not a sprawling polygon
  const cluster = (pcs, rx, ry, w = 0.6) => {
    let best = null, bestCost = Infinity;
    for (const start of nodes.filter(n => n.pc === pcs[0])) {
      const pick = [start];
      for (const pc of pcs.slice(1)) {
        const cx = pick.reduce((a, n) => a + n.x, 0) / pick.length, cy = pick.reduce((a, n) => a + n.y, 0) / pick.length;
        const cand = nodes.filter(n => n.pc === pc && !pick.includes(n)).sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - (b.x - cx) ** 2 - (b.y - cy) ** 2)[0];
        if (cand) pick.push(cand);
      }
      const cx = pick.reduce((a, n) => a + n.x, 0) / pick.length, cy = pick.reduce((a, n) => a + n.y, 0) / pick.length;
      const spread = pick.reduce((a, n) => a + Math.hypot(n.x - cx, n.y - cy), 0);
      const cost = spread + w * pick.length * Math.hypot(cx - rx, cy - ry);
      if (cost < bestCost) { bestCost = cost; best = { nodes: pick, x: cx, y: cy }; }
    }
    return best || { nodes: [], x: rx, y: ry };
  };
  // Seventh chords, etc.: notes outside the triad take the intersection closest to the triangle's center (drawn with the triangle as a four-note shape)
  const extraNodes = (c, pts, x, y) => c.notes.slice(3).map(m => nodes.filter(n => n.pc === mod12(m) && !pts.includes(n))
    .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - (b.x - x) ** 2 - (b.y - y) ** 2)[0]).filter(Boolean);
  // Seventh chord colors (as in the source book): dominant 7th green, major 7th red, minor 7th blue, half-diminished 7th purple; other non-triads gold
  const kindOf = c => { const iv = c.notes.map(n => n - c.root).join(",");
    return { "0,4,7,10": "dom7", "0,4,7,11": "maj7", "0,3,7,10": "min7", "0,3,6,10": "hdim7" }[iv] || "other"; };
  // Highlights other than major/minor triads (diminished, augmented, suspended, etc.): take each note's intersection closest to the center
  const hlOther = hlParsed.filter(h => !triadCore(h.c)).map(h => ({ sym: h.sym, ...cluster([...new Set(h.c.notes.map(mod12))], cx0, cy0) }));
  const hull = pts => { const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y); if (p.length < 3) return p;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  // Chord path: major/minor triads (including seventh chords built on them) take the triangle closest to the previous stop; other chords (diminished, augmented, etc.) take each note's intersection closest to the previous stop
  const route = useMemo(() => {
    if (!path) return [];
    // Cost = distance from previous stop + distance from the start (usually the tonic) × 0.8: the route stays connected and centers on the tonic
    let px = cx0, py = cy0, ax = null, ay = null; const out = [];
    const cost = (x, y) => Math.hypot(x - px, y - py) + (ax === null ? 0 : 0.8 * Math.hypot(x - ax, y - ay));
    for (const entry of path) {
      // A stop on the route: a chord symbol, or { name, notes:[midi…] } (a chord that can't be written as a symbol)
      const sym = typeof entry === "string" ? entry : entry.name;
      const c = typeof entry === "string" ? parseChord(sym) : { root: entry.notes[0], notes: entry.notes };
      const root = mod12(c.root), core = typeof entry === "string" ? triadCore(c) : null;
      const tri = core && c.notes.length >= 3 ? tris.filter(t => t.root === root && t.minor === core.minor) : [];
      let item;
      if (tri.length) {
        const ctr = t => [(t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3];
        const t = tri.sort((a, b) => cost(...ctr(a)) - cost(...ctr(b)))[0];
        const [x, y] = ctr(t); item = { sym, tri: t.key, x, y, nodes: t.pts, extra: extraNodes(c, t.pts, x, y), kind: kindOf(c) };
      } else {
        const g = cluster([...new Set(c.notes.map(mod12))], ax === null ? px : (px + ax) / 2, ax === null ? py : (py + ay) / 2);
        item = { sym, nodes: g.nodes, x: g.x, y: g.y, kind: kindOf(c) };
      }
      out.push(item); px = item.x; py = item.y; if (ax === null) { ax = item.x; ay = item.y; }
    }
    return out;
  }, [path && JSON.stringify(path), cols, rows, center, unit]); // eslint-disable-line
  const curItem = route[current];
  const axisT = t("au.axis");
  const AX = { fifths: { d: [1, 0], col: "#b8862b", axis: axisT.fifths }, M3: { d: [0, 1], col: "#9b2c1f", axis: axisT.M3 }, m3: { d: [-1, 1], col: "#2c4a6e", axis: axisT.m3 } };
  const roleOf = (tri, pc) => pc === tri.root ? t("au.roleRoot") : pc === mod12(tri.root + 7) ? t("au.roleFifth") : t("au.roleThird");
  return <div className="card au-tonnetz">
    {showAxesToggle && <div className="au-ctrl">
      <span className="au-lab">{t("au.showCycles")}</span>
      {Object.entries(AX).map(([k, a]) => <button key={k} className={ax.includes(k) ? "on" : ""} style={{ "--c": a.col }}
        onClick={() => setAx(ax.includes(k) ? ax.filter(x => x !== k) : [...ax, k])}>{a.axis[1]}</button>)}
    </div>}
    <svg viewBox={vb.join(" ")}>
      {tris.map(t => {
        const isHl = hlKeys.has(t.key), isSel = selT && selT.key === t.key;
        const sounding = t.pcs.every(p => activePc.has(p));
        return <polygon key={t.key} points={t.pts.map(p => p.x + "," + p.y).join(" ")}
          className={"au-tri " + (t.minor ? "min" : "maj") + (isHl ? " hl" : "") + (isSel ? " sel" : "") + (sounding ? " snd" : "") + (route.some(r => r.tri === t.key) ? " onpath" : "") + (curItem && curItem.tri === t.key ? " cur" : "")}
          onClick={() => clickTri(t)}><title>{triadName(t.root, t.minor, spell)}</title></polygon>;
      })}
      {tris.filter(t => hlKeys.has(t.key) || (selT && selT.key === t.key)).map(t => {
        const cx = (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, cy = (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3;
        return <text key={"l" + t.key} x={cx} y={cy + 5} className="au-tlabel">{(hlKeys.has(t.key) && hlName[(t.minor ? "m" : "M") + t.root]) || triadName(t.root, t.minor, spell)}</text>;
      })}
      {nodes.flatMap(n => [[1, 0], [0, 1], [-1, 1]].map(([di, dj], k) => {
        const m = at(n.i + di, n.j + dj); if (!m) return null;
        const axis = ["fifths", "M3", "m3"][k], on = ax.includes(axis);
        return <line key={n.i + "," + n.j + k} x1={n.x} y1={n.y} x2={m.x} y2={m.y} className={"au-edge e" + k + (on ? " on" : "")} style={on ? { stroke: AX[axis].col } : null} />;
      }))}
      {route.map((r, k) => r.extra && r.extra.length > 0 && (k === current || current < 0) &&
        <polygon key={"x" + k} points={hull([...r.nodes, ...r.extra]).map(n => n.x + "," + n.y).join(" ")} className={"au-seventh " + r.kind} />)}
      {hlOther.map((h, k) => <g key={"o" + k}>
        <polygon points={hull(h.nodes).map(n => n.x + "," + n.y).join(" ")} className="au-chordpoly" />
      </g>)}
      {route.length > 1 && <polyline points={route.map(r => r.x + "," + r.y).join(" ")} className="au-route" />}
      {route.map((r, k) => {   // Stops at the same position merge into one marker (e.g. 1·4); the current stop shows the chord name
        const same = route.map((q, m) => (q.x === r.x && q.y === r.y ? m : -1)).filter(m => m >= 0);
        if (k !== current && (same[0] !== k || same.includes(current))) return null;
        const label = k === current ? r.sym : same.map(m => m + 1).join("·");
        return <g key={"r" + k} className={"au-stop" + (k === current ? " cur" : "")}>
          {!r.tri && r.nodes.length > 1 && <polygon points={r.nodes.map(n => n.x + "," + n.y).join(" ")} className="au-chordpoly" />}
          <circle cx={r.x} cy={r.y} r={k === current ? 13 : 7 + 3 * label.length} /><text x={r.x} y={r.y + 4}>{label}</text>
        </g>;
      })}
      {nodes.map(n => {
        const on = activePc.has(n.pc), dim = notesSet && !notesSet.has(n.pc), inSel = selT && selT.pts.some(p => p === n);
        return <g key={n.i + "," + n.j} className="au-node" onClick={() => play([60 + n.pc], { dur: 1 })} opacity={dim && !on ? 0.3 : 1}>
          <circle cx={n.x} cy={n.y} r={on ? 15 : notesSet && !dim ? 14 : 12} className={"au-tn" + (on ? " on" : "") + (notesSet && !dim ? " mark" : "")} />
          <text x={n.x} y={n.y + 4} className={"au-nname" + (on ? " on" : "") + (isBlack(n.pc) ? " sm" : "")}>{pcName(n.pc, spell)}</text>
          {inSel && <text x={n.x} y={n.y - 17} className="au-role">{roleOf(selT, n.pc)}</text>}
        </g>;
      })}
      {hlOther.map((h, k) => { const top = h.nodes.slice().sort((a, b) => a.y - b.y)[0] || h;   // put the label to the upper right of the topmost intersection, to avoid covering triangle labels
        return <text key={"ol" + k} x={top.x + 22} y={top.y - 12} className="au-tlabel dark halo" textAnchor="start">{h.sym}</text>; })}
    </svg>
    {compact ? null : selT ? <div className="au-info">
      <b style={{ color: selT.minor ? "var(--blue)" : "var(--accent)" }}>{triadName(selT.root, selT.minor, spell)}</b>{selT.minor ? t("au.triadMinor") : t("au.triadMajor")}
      {t("au.triadParts", pcName(selT.root, spell), pcName(selT.root + (selT.minor ? 3 : 4), spell), pcName(selT.root + 7, spell))}
      <button className="au-mini" onClick={() => { const t = tris.find(x => x.root === selT.root && x.minor !== selT.minor); if (t) clickTri(t); }}>
        {t("au.flipThird", selT.minor, triadName(selT.root, !selT.minor, spell))}</button>
    </div> : <div className="au-info au-hint">{t("au.tonnetzHint")}{caption}</div>}
    {ax.length > 0 && <div className="au-legend">{ax.map(k => <span key={k} style={{ "--c": AX[k].col }}>{AX[k].axis[0]}{t("p.colon")}{AX[k].axis[1]}</span>)}</div>}
  </div>;
}

// Ear training. items: [{ q, play:{chord|notes|seq, arp, melodic}, options:[...], answer:index, why }]
export function EarQuiz({ items, title = t("au.earTitle") }) {
  const [k, setK] = useState(0), [pick, setPick] = useState(null), [score, setScore] = useState(0), [heard, setHeard] = useState(false);
  const it = items[k], done = k >= items.length;
  const listen = () => {
    const p = it.play; let steps = toSteps(p);
    if (p.melodic) steps = steps[0].notes.map(n => ({ notes: [n] }));
    stop(); steps.length === 1 ? play(steps[0].notes, { arp: p.arp || 0, dur: 1.8 }) : sequence(steps, { gap: p.gap || 0.7 });
    setHeard(true);
  };
  if (done) return <div className="card au-ear"><b>{t("au.earDone", title, score, items.length)}</b>
    <button className="au-go" onClick={() => { setK(0); setScore(0); setPick(null); setHeard(false); }}>{t("au.again")}</button></div>;
  return <div className="card au-ear">
    <div className="au-eartop"><small>{title} · {k + 1} / {items.length}</small><span>{t("au.score", score)}</span></div>
    <p>{it.q}</p>
    <button className="au-go big" onClick={listen}>▶ {heard ? t("au.replay") : t("au.play")}</button>
    <div className="au-opts">{it.options.map((o, i) => <button key={i} disabled={!heard || pick !== null}
      className={pick === null ? "" : i === it.answer ? "ok" : i === pick ? "bad" : ""}
      onClick={() => { setPick(i); if (i === it.answer) setScore(score + 1); }}>{o}</button>)}</div>
    {pick !== null && <div className="au-note">{pick === it.answer ? t("au.right") : t("au.wrong", it.options[it.answer])}{it.why}
      <button className="au-mini" onClick={() => { setK(k + 1); setPick(null); setHeard(false); }}>{t("au.nextQ")}</button></div>}
  </div>;
}

// Read this block aloud: reads the text of the enclosing Block with the browser's speech synthesis (speechSynthesis). Hidden when the browser doesn't support it.
export function Narrate({ label = t("au.narrate"), rate = 1 }) {
  const [on, setOn] = useState(false), ref = useRef();
  const ok = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => ok && on && speechSynthesis.cancel(), [on, ok]);
  if (!ok) return null;
  const go = () => {
    if (on) { speechSynthesis.cancel(); setOn(false); return; }
    const sec = ref.current.closest("section") || document.body;
    const clone = sec.cloneNode(true);
    clone.querySelectorAll("button, svg, select, input, .au-bar, .au-narr").forEach(n => n.remove());
    const text = clone.innerText.replace(/\s+/g, " ").trim();
    const parts = text.match(lang() === "zh" ? /[^。！？；\n]{1,160}[。！？；]?/g : /[^.!?;\n]{1,160}[.!?;]?/g) || [];
    const sl = t("speech.lang"), voices = speechSynthesis.getVoices(), norm = v => v.lang.replace("_", "-").toLowerCase();
    const voice = voices.find(v => norm(v) === sl.toLowerCase()) || voices.find(v => norm(v).startsWith(sl.split("-")[0]));
    speechSynthesis.cancel();
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p); u.lang = sl; u.rate = rate; if (voice) u.voice = voice;
      if (i === parts.length - 1) u.onend = () => setOn(false);
      speechSynthesis.speak(u);
    });
    setOn(true);
  };
  return <button ref={ref} className={"au-narr" + (on ? " on" : "")} onClick={go}>{on ? t("au.stopNarrate") : "🗣 " + label}</button>;
}

// 可听、可互动的音乐组件。说明见 framework/spec/AUDIO.md
import { useEffect, useMemo, useRef, useState } from "react";
import { play, sequence, stop, setSettings, useAudioState, TIMBRE_LABELS } from "./engine.js";
import { parseNote, parseNotes, parseChord, pcName, isBlack, mod12, cycle, cycleCount, intervalName, tonnetzPc, triadName } from "./theory.js";
import "./audio.css";

// 统一把 notes / chord / seq 转成播放步骤
function toSteps({ notes, chord, seq, octave = 4 }) {
  // seq 的每一项：含八度数字的视为音（"C4 E4"），否则视为和弦符号（"Am"）
  if (seq) return [].concat(seq).map(s => ({ notes: /\d/.test(s) && !/^[A-G][#♯b♭]?(7|6|5|maj7|m7|M7|m6|dim7|°7|mM7|sus[24])$/.test(s) ? parseNotes(s) : parseChord(s, octave).notes }));
  if (chord) return [{ notes: parseChord(chord, octave).notes }];
  return [{ notes: parseNotes(notes) }];
}

// ▶ 行内播放钮。<Play chord="C">C 和弦</Play>、<Play notes="C4 G4">纯五度</Play>、<Play seq={["C","Am","F","G"]} gap={0.9}/>
// arp：琶音间隔秒数（单个和弦时有效）；melodic：把 notes 逐个弹出
export function Play({ notes, chord, seq, arp = 0, melodic, gap = 0.6, octave, children, title }) {
  const [on, setOn] = useState(false);
  const go = e => {
    e.stopPropagation();
    let steps = toSteps({ notes, chord, seq, octave });
    if (melodic) steps = steps[0].notes.map(n => ({ notes: [n] }));
    setOn(true);
    if (steps.length === 1) { play(steps[0].notes, { arp }); setTimeout(() => setOn(false), 1200); }
    else sequence(steps, { gap, arp, onStep: i => i < 0 && setOn(false) });
  };
  return <button className={"au-play" + (on ? " on" : "")} onClick={go} title={title || "点击试听"}><i>{on ? "♪" : "▶"}</i>{children}</button>;
}

// 右下角固定的声音控制条（每章放一次）。tuning=true 时显示律制切换
export function SoundBar({ tuning = false }) {
  const { settings: s, active } = useAudioState();
  return <div className="au-bar">
    <button onClick={() => setSettings({ muted: !s.muted })} title={s.muted ? "取消静音" : "静音"}>{s.muted ? "🔇" : active.size ? "🔊" : "🔈"}</button>
    <input type="range" min="0" max="1" step="0.05" value={s.volume} onChange={e => setSettings({ volume: +e.target.value, muted: false })} aria-label="音量" />
    <select value={s.timbre} onChange={e => setSettings({ timbre: e.target.value })} aria-label="音色">
      {Object.entries(TIMBRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
    {tuning && <select value={s.tuning} onChange={e => setSettings({ tuning: e.target.value })} aria-label="律制">
      <option value="equal">平均律</option><option value="just">纯律</option></select>}
    <button onClick={stop} title="停止">■</button>
  </div>;
}

// 钢琴键盘。highlight：要标出的音（"C4 E4 G4" / MIDI 数组）；marks：{midi: 标签}；onNote(midi)：点击回调
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

const SHAPES = { 1: "十二边形（单个大圆）", 2: "直径（两两相对）", 3: "正三角形", 4: "正方形", 6: "正六边形", 12: "十二芒星" };
const CYCLE_COLORS = ["#9b2c1f", "#2c4a6e", "#3c6b4a", "#b8862b", "#5b3f7a", "#7a5b3f"];
const STEP_NAMES = { 1: "半音", 2: "全音", 3: "小三度", 4: "大三度", 5: "纯四度", 6: "三全音", 7: "纯五度", 8: "小六度", 9: "大六度", 10: "小七度", 11: "大七度" };

// 十二音循环圈：选步长 → 画出所有循环并可播放；可在「半音阶排列」与「五度圈排列」间切换（带动画）
// steps：可选的步长；arrange："chromatic" | "fifths"；lockArrange：隐藏排列切换
export function PitchCircle({ step: step0 = 1, steps = [1, 2, 3, 4, 5, 6, 7], start: start0 = 0, arrange = "chromatic", lockArrange = false, size = 340 }) {
  const [step, setStep] = useState(step0), [start, setStart] = useState(start0);
  const [target, setTarget] = useState(arrange === "fifths" ? 1 : 0), [mix, setMix] = useState(target);
  const [cur, setCur] = useState(-1);
  const { active } = useAudioState();
  const raf = useRef();
  useEffect(() => {   // 排列切换动画
    const from = mix, t0 = performance.now();
    const tick = t => { const k = Math.min(1, (t - t0) / 800), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setMix(from + (target - from) * e); if (k < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [target]); // eslint-disable-line
  const R = size / 2 - 34, C = size / 2;
  const pos = pc => {   // 两种排列的位置线性插值
    const a = i => (-90 + i * 30) * Math.PI / 180, p0 = a(pc), p1 = a(mod12(pc * 7));
    return [C + R * ((1 - mix) * Math.cos(p0) + mix * Math.cos(p1)), C + R * ((1 - mix) * Math.sin(p0) + mix * Math.sin(p1))];
  };
  const groups = useMemo(() => Array.from({ length: cycleCount(step) }, (_, g) => cycle(start + g, step)), [step, start]);
  const mine = groups[0];
  const activePc = new Set([...active].map(mod12));
  const playCycle = () => {
    stop();
    // 音高单调上行：每步 +step 半音，超出 C6 时回落一个八度
    let m = 60 + mod12(start); const seq = [m]; for (let k = 1; k <= mine.length; k++) { m += step; if (m > 84) m -= 12; seq.push(m); }
    sequence(seq.map(n => ({ notes: [n] })), { gap: 0.42, onStep: i => setCur(i) });
  };
  const n = mine.length;
  return <div className="card au-circle">
    <div className="au-ctrl">
      <span className="au-lab">步长</span>
      {steps.map(s => <button key={s} className={s === step ? "on" : ""} onClick={() => { stop(); setCur(-1); setStep(s); }}>{s}<small>{STEP_NAMES[s]}</small></button>)}
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
      <b>每步 {step} 个半音（{STEP_NAMES[step]}）</b>：从 {pcName(start)} 出发经过 {n} 个音回到起点，画出{SHAPES[n] || n + " 边形"}；
      这样的循环共有 <b>{groups.length}</b> 组{groups.length > 1 ? "（浅色为其余各组）" : "，走遍全部十二个音"}。
      <div className="au-seq">{mine.map((pc, k) => <span key={k} className={cur === k ? "on" : ""}>{pcName(pc)}</span>)}<span className={cur === n ? "on" : ""}>{pcName(mine[0])}</span></div>
    </div>
    <div className="au-ctrl">
      <button className="au-go" onClick={playCycle}>▶ 播放这个循环</button>
      {!lockArrange && <>
        <button className={target === 0 ? "on" : ""} onClick={() => setTarget(0)}>半音阶排列</button>
        <button className={target === 1 ? "on" : ""} onClick={() => setTarget(1)}>五度圈排列</button>
      </>}
      <span className="au-hint">点圆上的音：试听并设为起点</span>
    </div>
  </div>;
}

// 音程实验台：在键盘上点两个音（依次设为根音、冠音），显示半音数与音程名，可试听、转位
export function IntervalLab({ from = "C4", to = "B5", lo: lo0 = "C4", hi: hi0 = "E4" }) {
  const [lo, setLo] = useState(parseNote(lo0)), [hi, setHi] = useState(parseNote(hi0)), [next, setNext] = useState(0);
  const st = hi - lo;
  const pick = m => { if (next === 0) { setLo(m); if (m >= hi) setHi(m + 4); setNext(1); } else { if (m > lo) setHi(m); else { setHi(lo); setLo(m); } setNext(0); } };
  const invert = () => { if (st <= 0) return; if (lo + 12 > hi) { setLo(hi); setHi(lo + 12); } else setLo(lo + 12); };
  return <div className="card au-ilab">
    <Keyboard from={from} to={to} onNote={pick} highlight={[lo, hi]} marks={{ [lo]: "根", [hi]: "冠" }} names="C" />
    <div className="au-ireadout">
      <div><small>根音 → 冠音</small><b>{pcName(lo)} → {pcName(hi)}</b></div>
      <div><small>半音数</small><b>{st}</b></div>
      <div><small>音程</small><b>{intervalName(st)}</b></div>
    </div>
    <div className="au-ctrl">
      <button className="au-go" onClick={() => play([lo, hi], { arp: 0.5, dur: 1.6 })}>▶ 先后（旋律音程）</button>
      <button className="au-go" onClick={() => play([lo, hi], { dur: 1.6 })}>▶ 同时（和声音程）</button>
      <button onClick={invert} disabled={st <= 0 || st > 12}>⇅ 转位</button>
      <span className="au-hint">{next === 0 ? "在键盘上点一个音作为根音" : "再点一个音作为冠音"}</span>
    </div>
    {st > 0 && st < 12 && <div className="au-note">转位后是 <b>{intervalName(12 - st)}</b>：{st} + {12 - st} = 12 个半音，正好一个纯八度。</div>}
  </div>;
}

// Tonnetz 网格图（方向与配色同《图解和声》：横向纯五度，右上大三度，左上小三度；朝上三角 = 大三和弦（红），朝下 = 小三和弦（蓝））
// highlight：["C","Em"] 预先标出的和弦；notes：要标出的音级集合（如全音阶 [0,2,4,6,8,10]）
// axes：显示哪些轴上的循环线 ["fifths","M3","m3"]；center：中心音；select：初始选中的和弦
export function Tonnetz({ cols = 11, rows = 6, center = "C", highlight = [], notes, axes = [], showAxesToggle = false, select, spell = "flat", unit = 62, caption, onChord }) {
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
  const hlSet = new Set(highlight.map(s => { const c = parseChord(s); return (c.type.startsWith("m") ? "m" : "M") + mod12(c.root); }));
  const activePc = new Set([...active].map(mod12)), notesSet = notes ? new Set(notes.map(mod12)) : null;
  const voicing = t => { const r = 60 + t.root; return [r, r + (t.minor ? 3 : 4), r + 7]; };
  const clickTri = t => { play(voicing(t), { arp: 0.04, dur: 1.6 }); setSel(t.key); onChord && onChord(triadName(t.root, t.minor, spell)); };
  const selT = tris.find(t => t.key === sel) || (select && tris.find(t => (t.minor ? "m" : "M") + t.root === select));
  const AX = { fifths: { d: [1, 0], col: "#b8862b", name: "横线：纯五度循环（五度圈）" }, M3: { d: [0, 1], col: "#9b2c1f", name: "右上斜线：大三度循环（3 个音）" }, m3: { d: [-1, 1], col: "#2c4a6e", name: "左上斜线：小三度循环（4 个音）" } };
  const roleOf = (t, pc) => pc === t.root ? "根" : pc === mod12(t.root + 7) ? "五" : "三";
  return <div className="card au-tonnetz">
    {showAxesToggle && <div className="au-ctrl">
      <span className="au-lab">显示循环</span>
      {Object.entries(AX).map(([k, a]) => <button key={k} className={ax.includes(k) ? "on" : ""} style={{ "--c": a.col }}
        onClick={() => setAx(ax.includes(k) ? ax.filter(x => x !== k) : [...ax, k])}>{a.name.split("：")[1]}</button>)}
    </div>}
    <svg viewBox={vb.join(" ")}>
      {tris.map(t => {
        const isHl = hlSet.has((t.minor ? "m" : "M") + t.root), isSel = selT && selT.key === t.key;
        const sounding = t.pcs.every(p => activePc.has(p));
        return <polygon key={t.key} points={t.pts.map(p => p.x + "," + p.y).join(" ")}
          className={"au-tri " + (t.minor ? "min" : "maj") + (isHl ? " hl" : "") + (isSel ? " sel" : "") + (sounding ? " snd" : "")}
          onClick={() => clickTri(t)}><title>{triadName(t.root, t.minor, spell)}</title></polygon>;
      })}
      {tris.filter(t => hlSet.has((t.minor ? "m" : "M") + t.root) || (selT && selT.key === t.key)).map(t => {
        const cx = (t.pts[0].x + t.pts[1].x + t.pts[2].x) / 3, cy = (t.pts[0].y + t.pts[1].y + t.pts[2].y) / 3;
        return <text key={"l" + t.key} x={cx} y={cy + 5} className="au-tlabel">{triadName(t.root, t.minor, spell)}</text>;
      })}
      {nodes.flatMap(n => [[1, 0], [0, 1], [-1, 1]].map(([di, dj], k) => {
        const m = at(n.i + di, n.j + dj); if (!m) return null;
        const axis = ["fifths", "M3", "m3"][k], on = ax.includes(axis);
        return <line key={n.i + "," + n.j + k} x1={n.x} y1={n.y} x2={m.x} y2={m.y} className={"au-edge e" + k + (on ? " on" : "")} style={on ? { stroke: AX[axis].col } : null} />;
      }))}
      {nodes.map(n => {
        const on = activePc.has(n.pc), dim = notesSet && !notesSet.has(n.pc), inSel = selT && selT.pts.some(p => p === n);
        return <g key={n.i + "," + n.j} className="au-node" onClick={() => play([60 + n.pc], { dur: 1 })} opacity={dim ? 0.3 : 1}>
          <circle cx={n.x} cy={n.y} r={on ? 15 : notesSet && !dim ? 14 : 12} className={"au-tn" + (on ? " on" : "") + (notesSet && !dim ? " mark" : "")} />
          <text x={n.x} y={n.y + 4} className={"au-nname" + (on ? " on" : "") + (isBlack(n.pc) ? " sm" : "")}>{pcName(n.pc, spell)}</text>
          {inSel && <text x={n.x} y={n.y - 17} className="au-role">{roleOf(selT, n.pc)}</text>}
        </g>;
      })}
    </svg>
    {selT ? <div className="au-info">
      <b style={{ color: selT.minor ? "var(--blue)" : "var(--accent)" }}>{triadName(selT.root, selT.minor, spell)}</b>：{selT.minor ? "小三和弦（小三度 + 大三度），朝下的蓝色三角" : "大三和弦（大三度 + 小三度），朝上的红色三角"}；
      根音 {pcName(selT.root, spell)} · 三音 {pcName(selT.root + (selT.minor ? 3 : 4), spell)} · 五音 {pcName(selT.root + 7, spell)}。
      <button className="au-mini" onClick={() => { const t = tris.find(x => x.root === selT.root && x.minor !== selT.minor); if (t) clickTri(t); }}>
        ⇅ 只把三音{selT.minor ? "升" : "降"}半音 → {triadName(selT.root, !selT.minor, spell)}</button>
    </div> : <div className="au-info au-hint">点任意三角形听和弦，点交点听单音。{caption}</div>}
    {ax.length > 0 && <div className="au-legend">{ax.map(k => <span key={k} style={{ "--c": AX[k].col }}>{AX[k].name}</span>)}</div>}
  </div>;
}

// 听音练习。items: [{ q, play:{chord|notes|seq, arp, melodic}, options:[...], answer:索引, why }]
export function EarQuiz({ items, title = "听音练习" }) {
  const [k, setK] = useState(0), [pick, setPick] = useState(null), [score, setScore] = useState(0), [heard, setHeard] = useState(false);
  const it = items[k], done = k >= items.length;
  const listen = () => {
    const p = it.play; let steps = toSteps(p);
    if (p.melodic) steps = steps[0].notes.map(n => ({ notes: [n] }));
    stop(); steps.length === 1 ? play(steps[0].notes, { arp: p.arp || 0, dur: 1.8 }) : sequence(steps, { gap: p.gap || 0.7 });
    setHeard(true);
  };
  if (done) return <div className="card au-ear"><b>{title}完成：{score} / {items.length}</b>
    <button className="au-go" onClick={() => { setK(0); setScore(0); setPick(null); setHeard(false); }}>再练一次</button></div>;
  return <div className="card au-ear">
    <div className="au-eartop"><small>{title} · {k + 1} / {items.length}</small><span>得分 {score}</span></div>
    <p>{it.q}</p>
    <button className="au-go big" onClick={listen}>▶ {heard ? "再听一次" : "播放"}</button>
    <div className="au-opts">{it.options.map((o, i) => <button key={i} disabled={!heard || pick !== null}
      className={pick === null ? "" : i === it.answer ? "ok" : i === pick ? "bad" : ""}
      onClick={() => { setPick(i); if (i === it.answer) setScore(score + 1); }}>{o}</button>)}</div>
    {pick !== null && <div className="au-note">{pick === it.answer ? "✓ 对了。" : "✗ 正确答案是：" + it.options[it.answer] + "。"}{it.why}
      <button className="au-mini" onClick={() => { setK(k + 1); setPick(null); setHeard(false); }}>下一题 →</button></div>}
  </div>;
}

// 朗读本区块：用浏览器语音合成（speechSynthesis）读出所在 Block 的文字。浏览器不支持时不显示。
export function Narrate({ label = "朗读本节", rate = 1 }) {
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
    const parts = text.match(/[^。！？；\n]{1,160}[。！？；]?/g) || [];
    const voice = speechSynthesis.getVoices().find(v => /zh[-_]CN/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^zh/i.test(v.lang));
    speechSynthesis.cancel();
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p); u.lang = "zh-CN"; u.rate = rate; if (voice) u.voice = voice;
      if (i === parts.length - 1) u.onend = () => setOn(false);
      speechSynthesis.speak(u);
    });
    setOn(true);
  };
  return <button ref={ref} className={"au-narr" + (on ? " on" : "")} onClick={go}>{on ? "■ 停止朗读" : "🗣 " + label}</button>;
}

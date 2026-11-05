import { t } from "../i18n/index.js";
// 谱例：ABC 记谱 → 两种视图一键切换（全站共享偏好）：
//   五线谱（abcjs 渲染）⇄ 卷帘 Piano Roll（像 Logic Pro：横轴时间、纵轴音高、左侧键盘，音符是长条）。
// 声音走本站引擎（engine.js），播放时音符同步高亮、卷帘有播放头；点任意音符/音条单独试听。
// abcjs 只在浏览器里按需加载（构建期 SSR 提取数据时不会触碰它）。说明见 framework/spec/AUDIO.md
import { useEffect, useRef, useState } from "react";
import { play, stop, later, onStop, setSettings, useAudioState } from "./engine.js";
import { voiceChord, parseChord, pcName, isBlack, mod12 } from "./theory.js";

// 由简写属性拼出完整 ABC。
//   abc 含 "K:" 时视为完整 ABC，原样使用；否则把它当作（高音谱表）正文，配合 bass（低音谱表正文）生成大谱表。
function buildAbc({ abc, bass, meter = "4/4", unit = "1/4", keySig = "C", tempo, title }) {
  if (/^\s*K:/m.test(abc)) return abc;
  const head = [`X:1`, title ? `T:${title}` : null, `M:${meter}`, `L:${unit}`, tempo ? `Q:1/4=${tempo}` : null].filter(Boolean);
  if (bass === undefined) return [...head, `K:${keySig}`, abc.trim()].join("\n");
  return [...head, `%%score {RH | LH}`, `K:${keySig}`, `V:RH clef=treble`, abc.trim(), `V:LH clef=bass`, bass.trim()].join("\n");
}

// <Score abc="&quot;C&quot;[CEG]4 | &quot;G&quot;[B,DG]4 |]" />
// <Score abc="[EGc]4 | [DGB]4 |]" bass="C,4 | G,,4 |]" keySig="C" meter="4/4" tempo={72} caption="…"/>
// 属性：abc（高音谱表正文或完整 ABC）· bass（低音谱表正文 → 大谱表）· keySig · meter · unit（默认 1/4）· tempo（每分钟四分音符数）
//       caption · scale（缩放，默认 1）· width（谱表宽度 px，默认自适应）· playable（默认 true）
// accomp：播放时按谱上的和弦记号（"C" "Am7" "G/B"）自动弹柱式和弦伴奏（适合只有旋律的谱例）
export function Score({ abc, bass, keySig, meter, unit, tempo = 80, title, caption, scale = 1, width, playable = true, accomp = false }) {
  const box = useRef(), tune = useRef(null), [ready, setReady] = useState(false), [on, setOn] = useState(false), [err, setErr] = useState(null);
  const [pos, setPos] = useState(-1), t0 = useRef(0), [view0, setView0] = useState(null);
  const { settings, active } = useAudioState();
  const view = view0 || settings.view || "staff";
  useEffect(() => onStop(() => { setOn(false); setPos(-1); }), []);
  useEffect(() => {   // 播放头：按真实时间推进
    if (!on) return; let raf;
    const tick = () => { setPos(performance.now() - t0.current); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [on]);
  const text = buildAbc({ abc, bass, keySig, meter, unit, tempo, title });
  useEffect(() => {
    let dead = false;
    import("abcjs").then(({ default: abcjs }) => {
      if (dead || !box.current) return;
      try {
        const [v] = abcjs.renderAbc(box.current, text, {
          add_classes: true, responsive: width ? undefined : "resize", staffwidth: width, scale, paddingtop: 6, paddingbottom: 6,
          paddingleft: 0, paddingright: 0, foregroundColor: "#2b2620",
          clickListener: el => el.midiPitches && play(el.midiPitches.map(p => p.pitch), { dur: 1.2, arp: el.midiPitches.length > 1 ? 0.03 : 0 }),
        });
        const qpm = v.getBpm ? v.getBpm() || tempo : tempo;
        v.setUpAudio({ qpm });   // 填充每个音符的 midiPitches（音高与时值），供播放与点击试听
        const tc = new abcjs.TimingCallbacks(v, { qpm });
        // 和弦记号及其时间（setUpAudio 后每个音符元素带 currentTrackMilliseconds）
        const chords = [];
        for (const line of v.lines || []) for (const st of line.staff || []) for (const voice of (st.voices || []).slice(0, 1)) for (const el of voice) {
          const name = (el.chord || []).find(ch => !ch.position || ch.position === "default" || ch.position === "above")?.name;
          if (name && el.currentTrackMilliseconds != null) chords.push({ name: name.trim(), ms: [].concat(el.currentTrackMilliseconds)[0] });
        }
        const total = tc.noteTimings.length ? tc.noteTimings[tc.noteTimings.length - 1].milliseconds : 0;
        const events = tc.noteTimings.filter(e => e.type === "event"), msPerWhole = 4 * 60000 / qpm;
        // 卷帘数据：每个音一根条（同一时刻、同一音高去重）
        const seen = new Set(), notes = [];
        for (const e of events) for (const p of e.midiPitches || []) {
          if (p.pitch == null) continue; const k = e.milliseconds + ":" + p.pitch; if (seen.has(k)) continue; seen.add(k);
          notes.push({ pitch: p.pitch, start: e.milliseconds, dur: p.duration * msPerWhole });
        }
        const bars = [...new Set(tc.noteTimings.filter(e => e.measureStart).map(e => e.milliseconds))].sort((a, b) => a - b);
        const end = Math.max(total, ...notes.map(n => n.start + n.dur));
        tune.current = { events, msPerWhole, chords: chords.sort((a, b) => a.ms - b.ms), total, notes, bars, end, qpm };
        setReady(true);
      } catch (e) { setErr(String(e.message || e)); }
    }).catch(e => setErr(t("au.scoreFail", e.message)));
    return () => { dead = true; };
  }, [text, scale, width]); // eslint-disable-line

  const mark = (els, cls, add) => (els || []).flat().forEach(el => el && el.classList && el.classList[add ? "add" : "remove"](cls));
  const go = () => {
    if (on) { stop(); setOn(false); return; }
    const t = tune.current; if (!t) return;
    stop(); setOn(true); t0.current = performance.now(); setPos(0);
    let end = 0;
    for (const e of t.events) {
      const at = e.milliseconds / 1000;
      const ps = (e.midiPitches || []).filter(p => p.pitch != null);
      ps.forEach(p => play([p.pitch], { at, dur: Math.max(0.15, p.duration * t.msPerWhole / 1000 * 0.95), velocity: p.volume ? Math.min(1, p.volume / 100) : 0.8 }));
      const len = ps.length ? Math.max(...ps.map(p => p.duration)) * t.msPerWhole : 300;
      later(() => mark(e.elements, "au-hl", true), e.milliseconds);
      later(() => mark(e.elements, "au-hl", false), e.milliseconds + len * 0.95);
      end = Math.max(end, e.milliseconds + len);
    }
    if (accomp) for (const a of accompNotes(t.chords, Math.max(t.total, end)))   // 和弦记号伴奏：持续到下一个记号（或乐曲结束）
      play(a.notes, { at: a.start / 1000, dur: a.dur / 1000 * 0.97, velocity: 0.45 });
    later(() => { setOn(false); setPos(-1); }, end + 200);
  };
  const toggleView = () => { const v = view === "roll" ? "staff" : "roll"; setView0(null); setSettings({ view: v }); };
  return <figure className="card au-score">
    <div ref={box} className={"au-abc" + (view === "roll" ? " hide" : "")} />
    {view === "roll" && ready && <PianoRoll data={tune.current} pos={on ? pos : -1} active={active} accomp={accomp} />}
    {err && <div className="au-note">{err}</div>}
    <figcaption>
      {playable && <button className="au-go" disabled={!ready} onClick={go}>{on ? t("au.stopBtn") : t("au.playScore")}</button>}
      <button className="au-view" onClick={toggleView} title={t("au.viewTitle")}>
        {view === "roll" ? t("au.viewStaff") : t("au.viewRoll")}</button>
      {caption && <span>{caption}</span>}
      {playable && <span className="au-hint">{view === "roll" ? t("au.rollHint") : t("au.staffHint")}</span>}
    </figcaption>
  </figure>;
}

// 由和弦记号生成伴奏：[{ notes, start, dur }]。斜线和弦（"D/A"）额外在下方弹低音
function accompNotes(chords, end) {
  const out = []; let prev;
  chords.forEach((c, i) => {
    const [sym, bassName] = c.name.split("/"); let ns;
    try { ns = voiceChord(sym, { prev, lo: 48, style: "smooth" }); } catch { return; }
    prev = ns; const until = i + 1 < chords.length ? chords[i + 1].ms : end;
    const notes = [...ns];
    if (bassName) { try { const b = mod12(parseChord(bassName.trim()).root); notes.unshift(40 + mod12(b - 40)); } catch { /* 低音写法无法解析时忽略 */ } }
    out.push({ notes, start: c.ms, dur: Math.max(300, until - c.ms) });
  });
  return out;
}

// 卷帘（Piano Roll）：横轴时间（每四分音符 PXQ 像素），纵轴音高（每半音一行）；左侧固定键盘，黑键行加深；顶部和弦记号与小节号
const PXQ = 46, KB = 40, TOP = 32;
function PianoRoll({ data, pos, active, accomp }) {
  const scroller = useRef();
  const { notes, bars, chords, end, qpm } = data;
  const msQ = 60000 / qpm, px = ms => 4 + (ms / msQ) * PXQ;
  // 伴奏音（accomp 时由和弦记号生成）也画出来，颜色较浅
  const acc = accomp ? accompNotes(chords, end).flatMap(a => a.notes.map(p => ({ pitch: p, start: a.start, dur: a.dur, acc: true }))) : [];
  const all = [...acc, ...notes];
  const lo = all.length ? Math.min(...all.map(n => n.pitch)) - 2 : 58, hi = all.length ? Math.max(...all.map(n => n.pitch)) + 2 : 74;
  const rowH = Math.max(7, Math.min(13, Math.floor(260 / (hi - lo + 1))));
  const y = p => TOP + (hi - p) * rowH, W = px(end) + 16, H = TOP + (hi - lo + 1) * rowH + 4;
  useEffect(() => {   // 播放头跑出视野时自动滚动
    const el = scroller.current; if (!el || pos < 0) return; const x = px(pos);
    if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
  }, [pos]); // eslint-disable-line
  const rows = []; for (let p = hi; p >= lo; p--) rows.push(p);
  const on = n => pos >= n.start && pos < n.start + n.dur;
  return <div className="au-roll">
    <svg className="au-rkbsvg" width={KB} height={H} viewBox={`0 0 ${KB} ${H}`}>
      {rows.map(p => !isBlack(p) && <rect key={"k" + p} x={0} y={y(p)} width={KB - 1} height={rowH}
        className={"au-rkey" + (active.has(p) ? " act" : "")} onClick={() => play([p], { dur: 0.9 })} />)}
      {rows.map(p => isBlack(p) && <rect key={"k" + p} x={0} y={y(p) + 0.5} width={KB * 0.6} height={rowH - 1}
        className={"au-rkey b" + (active.has(p) ? " act" : "")} onClick={() => play([p], { dur: 0.9 })} />)}
      {rows.filter(p => p % 12 === 0).map(p => <text key={"t" + p} x={KB - 4} y={y(p) + rowH - 1.5} className="au-rkname">C{p / 12 - 1}</text>)}
    </svg>
    <div className="au-rscroll" ref={scroller}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {rows.map(p => <rect key={"r" + p} x={0} y={y(p)} width={W} height={rowH} className={isBlack(p) ? "au-rrow b" : "au-rrow"} />)}
        {rows.filter(p => p % 12 === 0).map(p => <line key={"c" + p} x1={0} x2={W} y1={y(p) + rowH} y2={y(p) + rowH} className="au-rcline" />)}
        {bars.map((b, i) => <g key={"b" + i}><line x1={px(b)} x2={px(b)} y1={TOP - 4} y2={H} className="au-rbar" />
          <text x={px(b) + 3} y={TOP - 6} className="au-rbarno">{i + 1}</text></g>)}
        {chords.map((c, i) => <text key={"h" + i} x={px(c.ms) + 3} y={13} className="au-rchord">{c.name}</text>)}
        {all.map((n, i) => <rect key={i} x={px(n.start) + 0.5} y={y(n.pitch) + 1} width={Math.max(3, (n.dur / msQ) * PXQ - 1.5)} height={rowH - 2} rx={2.5}
          className={"au-rnote" + (n.acc ? " acc" : "") + (on(n) ? " on" : "")} onClick={() => play([n.pitch], { dur: 0.9 })}>
          <title>{pcName(n.pitch, "both") + (Math.floor(n.pitch / 12) - 1)}</title></rect>)}
        {pos >= 0 && <line x1={px(pos)} x2={px(pos)} y1={0} y2={H} className="au-rhead" />}
      </svg>
    </div>
  </div>;
}

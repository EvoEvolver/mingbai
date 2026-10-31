// 五线谱：abcjs 渲染 ABC 记谱，声音走本站引擎（engine.js），播放时音符同步高亮；点任意音符/和弦单独试听。
// abcjs 只在浏览器里按需加载（构建期 SSR 提取数据时不会触碰它）。说明见 framework/spec/AUDIO.md
import { useEffect, useRef, useState } from "react";
import { play, stop, later } from "./engine.js";

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
export function Score({ abc, bass, keySig, meter, unit, tempo = 80, title, caption, scale = 1, width, playable = true }) {
  const box = useRef(), tune = useRef(null), [ready, setReady] = useState(false), [on, setOn] = useState(false), [err, setErr] = useState(null);
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
        tune.current = { events: tc.noteTimings.filter(e => e.type === "event"), msPerWhole: 4 * 60000 / qpm };
        setReady(true);
      } catch (e) { setErr(String(e.message || e)); }
    }).catch(e => setErr("乐谱组件加载失败：" + e.message));
    return () => { dead = true; };
  }, [text, scale, width]); // eslint-disable-line

  const mark = (els, cls, add) => (els || []).flat().forEach(el => el && el.classList && el.classList[add ? "add" : "remove"](cls));
  const go = () => {
    if (on) { stop(); setOn(false); return; }
    const t = tune.current; if (!t) return;
    stop(); setOn(true);
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
    later(() => setOn(false), end + 200);
  };
  return <figure className="card au-score">
    <div ref={box} className="au-abc" />
    {err && <div className="au-note">{err}</div>}
    <figcaption>
      {playable && <button className="au-go" disabled={!ready} onClick={go}>{on ? "■ 停止" : "▶ 播放乐谱"}</button>}
      {caption && <span>{caption}</span>}
      {playable && <span className="au-hint">点任意音符或和弦可单独试听</span>}
    </figcaption>
  </figure>;
}

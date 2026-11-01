// 和弦进行播放器：和弦卡片 + 播放头 + 速度/织体/连接方式/循环；可同步在 Tonnetz 上画出路线、在键盘上显示按键。
import { useEffect, useMemo, useRef, useState } from "react";
import { play, stop, later, onStop, useAudioState } from "./engine.js";
import { parseChord, parseNotes, romanOf, voiceChord, mod12, prettyChord } from "./theory.js";
import { Tonnetz, Keyboard } from "./components.jsx";

const TEXTURES = { block: "柱式", arp: "琶音", pop: "低音 + 和弦" };

// <Progression chords={["C","Am","F","G"]} keyName="C" tonnetz keyboard />
// 属性：chords（和弦符号数组，可用 "C/E" 指定低音）· keyName（调，如 "C"、"Am"：自动标级数）· roman（自定义级数标签数组，优先于 keyName）
//       bpm（默认 84）· beats（每个和弦几拍，默认 4；也可传数组逐个指定）· texture（"block"|"arp"|"pop"）· voicing（"smooth"|"close"）
//       loop · tonnetz（true 或 Tonnetz 属性对象，如 {cols:10, rows:5, center:"C"}）· keyboard（true 显示键盘）· title · caption
export function Progression({ chords, keyName, roman, bpm: bpm0 = 84, beats = 4, texture: tex0 = "block", voicing: voi0 = "smooth", loop: loop0 = false, tonnetz, keyboard, title, caption }) {
  const [bpm, setBpm] = useState(bpm0), [texture, setTexture] = useState(tex0), [voicing, setVoicing] = useState(voi0), [loop, setLoop] = useState(loop0);
  const [cur, setCur] = useState(-1), playing = useRef(false), [on, setOn] = useState(false);
  useAudioState();
  // 任何 stop()（SoundBar 的 ■、其他组件开始播放）都把本播放器复位；start() 内部先 stop() 再置 on，不受影响
  useEffect(() => onStop(() => { playing.current = false; setOn(false); setCur(-1); }), []);
  const items = useMemo(() => {
    let prev;
    return chords.map((entry, k) => {
      // 和弦可写成符号 "G7"、"C/E"，或 { name:"Cm♭6", notes:"C3 Eb4 G4 Ab4", roman? }（直接给出音高，按原样弹奏）
      if (typeof entry === "object") {
        const notes = parseNotes(entry.notes); prev = notes.slice(1);
        return { full: entry.name, sym: null, upper: notes.slice(1), bass: notes[0], notes, beats: Array.isArray(beats) ? beats[k] ?? 4 : beats,
          roman: entry.roman ?? (roman ? roman[k] : ""), minor: !!entry.minor };
      }
      const full = entry;
      const [sym, bassName] = full.split("/"), c = parseChord(sym);
      const upper = voiceChord(sym, { prev, style: voicing }); prev = upper;
      const bassPc = bassName ? mod12(parseChord(bassName).root) : mod12(c.root);
      const bass = 40 + mod12(bassPc - 40);   // 低音落在 E2–D♯3
      return { full, sym, upper, bass, beats: Array.isArray(beats) ? beats[k] ?? 4 : beats,
        roman: roman ? roman[k] : keyName ? romanOf(sym, keyName) + (bassName ? "/" + bassName : "") : "" };
    });
  }, [JSON.stringify(chords), voicing, keyName, roman && roman.join(" "), Array.isArray(beats) ? beats.join(" ") : beats]); // eslint-disable-line

  // 按织体安排一个和弦的发声；at 为起点秒数，len 为时长秒数
  const render = (it, at, len) => {
    const beat = len / it.beats;
    if (texture === "block") { play([it.bass], { at, dur: len * 0.98, velocity: 0.7 }); play(it.upper, { at, dur: len * 0.98, velocity: 0.62 }); }
    else if (texture === "arp") {
      const tones = [it.bass, ...it.upper, it.upper[1] + 12, ...it.upper.slice().reverse()].slice(0, it.beats * 2);
      tones.forEach((m, i) => play([m], { at: at + i * beat / 2, dur: Math.max(beat * 0.9, 0.25), velocity: i === 0 ? 0.75 : 0.55 }));
    } else {
      for (let b = 0; b < it.beats; b++) {
        if (b % 2 === 0) play([b === 0 ? it.bass : it.bass + 7], { at: at + b * beat, dur: beat * 0.95, velocity: 0.75 });
        play(it.upper, { at: at + b * beat + (b % 2 ? 0 : beat / 2), dur: beat * 0.45, velocity: b % 2 ? 0.55 : 0.42 });
      }
    }
  };
  const start = (from = 0) => {
    stop(); playing.current = true; setOn(true);
    const spb = 60 / bpm; let t = 0;
    items.forEach((it, k) => {
      if (k < from) return;
      const len = it.beats * spb; render(it, t, len);
      later(() => setCur(k), t * 1000); t += len;
    });
    later(() => { if (loop && playing.current) start(0); else { playing.current = false; setOn(false); setCur(-1); } }, t * 1000);
  };
  const halt = () => { playing.current = false; stop(); setOn(false); setCur(-1); };
  const one = k => { stop(); setCur(k); render(items[k], 0, items[k].beats * 60 / bpm); later(() => setCur(-1), items[k].beats * 60000 / bpm); };
  const tz = tonnetz === true ? {} : tonnetz;
  return <div className="card au-prog">
    {title && <div className="au-progtitle">{title}</div>}
    <div className="au-chords">
      {items.map((it, k) => <button key={k} className={"au-chord" + (k === cur ? " cur" : "") + ((it.sym ? parseChord(it.sym).notes[1] - parseChord(it.sym).root === 3 : it.minor) ? " min" : "")} onClick={() => one(k)}>
        <b>{it.sym ? prettyChord(it.full) : it.full}</b>{it.roman && <small>{it.roman}</small>}
      </button>)}
    </div>
    <div className="au-ctrl">
      <button className="au-go" onClick={() => (on ? halt() : start(0))}>{on ? "■ 停止" : "▶ 播放进行"}</button>
      <label className="au-lab">速度 <input type="range" min="40" max="160" value={bpm} onChange={e => setBpm(+e.target.value)} /> {bpm}</label>
      {Object.entries(TEXTURES).map(([k, v]) => <button key={k} className={texture === k ? "on" : ""} onClick={() => setTexture(k)}>{v}</button>)}
      <button className={voicing === "smooth" ? "on" : ""} onClick={() => setVoicing(voicing === "smooth" ? "close" : "smooth")} title="平滑连接：每个和弦选离上一个最近的转位">{voicing === "smooth" ? "平滑连接" : "原位排列"}</button>
      <button className={loop ? "on" : ""} onClick={() => setLoop(!loop)}>⟲ 循环</button>
    </div>
    {tz && <Tonnetz cols={10} rows={5} unit={50} compact {...tz} path={items.map(i => i.sym ?? { name: i.full, notes: i.notes })} current={cur} />}
    {keyboard && <Keyboard from="C2" to="B5" names="C" height={80} />}
    {caption && <div className="au-hint" style={{ marginTop: 6 }}>{caption}</div>}
  </div>;
}

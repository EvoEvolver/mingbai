import { t } from "../i18n/index.js";
// Chord progression player: chord cards + playhead + speed/texture/voicing/loop; can also draw the route on a Tonnetz and show the keys on a keyboard.
import { useEffect, useMemo, useRef, useState } from "react";
import { play, stop, later, onStop, useAudioState } from "./engine.js";
import { parseChord, parseNotes, romanOf, voiceChord, mod12, prettyChord } from "./theory.js";
import { Tonnetz, Keyboard } from "./components.jsx";


// <Progression chords={["C","Am","F","G"]} keyName="C" tonnetz keyboard />
// Props: chords (array of chord symbols; "C/E" sets the bass) · keyName (key, e.g. "C", "Am": labels numerals automatically) · roman (custom numeral labels array, takes priority over keyName)
//       bpm (default 84) · beats (beats per chord, default 4; or an array, one per chord) · texture ("block"|"arp"|"pop") · voicing ("smooth"|"close")
//       loop · tonnetz (true or a Tonnetz props object, e.g. {cols:10, rows:5, center:"C"}) · keyboard (true shows the keyboard) · title · caption
export function Progression({ chords, keyName, roman, bpm: bpm0 = 84, beats = 4, texture: tex0 = "block", voicing: voi0 = "smooth", loop: loop0 = false, tonnetz, keyboard, title, caption }) {
  const [bpm, setBpm] = useState(bpm0), [texture, setTexture] = useState(tex0), [voicing, setVoicing] = useState(voi0), [loop, setLoop] = useState(loop0);
  const [cur, setCur] = useState(-1), playing = useRef(false), [on, setOn] = useState(false);
  useAudioState();
  // Any stop() (SoundBar's ■, or another component starting playback) resets this player; start() itself calls stop() and then sets on, so it isn't affected
  useEffect(() => onStop(() => { playing.current = false; setOn(false); setCur(-1); }), []);
  const items = useMemo(() => {
    let prev;
    return chords.map((entry, k) => {
      // A chord can be a symbol "G7", "C/E", or { name:"Cm♭6", notes:"C3 Eb4 G4 Ab4", roman? } (explicit pitches, played as given)
      if (typeof entry === "object") {
        const notes = parseNotes(entry.notes); prev = notes.slice(1);
        return { full: entry.name, sym: null, upper: notes.slice(1), bass: notes[0], notes, beats: Array.isArray(beats) ? beats[k] ?? 4 : beats,
          roman: entry.roman ?? (roman ? roman[k] : ""), minor: !!entry.minor };
      }
      const full = entry;
      const [sym, bassName] = full.split("/"), c = parseChord(sym);
      const upper = voiceChord(sym, { prev, style: voicing }); prev = upper;
      const bassPc = bassName ? mod12(parseChord(bassName).root) : mod12(c.root);
      const bass = 40 + mod12(bassPc - 40);   // bass falls in E2–D♯3
      return { full, sym, upper, bass, beats: Array.isArray(beats) ? beats[k] ?? 4 : beats,
        roman: roman ? roman[k] : keyName ? romanOf(sym, keyName) + (bassName ? "/" + bassName : "") : "" };
    });
  }, [JSON.stringify(chords), voicing, keyName, roman && roman.join(" "), Array.isArray(beats) ? beats.join(" ") : beats]); // eslint-disable-line

  // Schedule one chord's notes by texture; at is the start in seconds, len the duration in seconds
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
      <button className="au-go" onClick={() => (on ? halt() : start(0))}>{on ? t("au.stopBtn") : t("au.playProg")}</button>
      <label className="au-lab">{t("au.tempo")} <input type="range" min="40" max="160" value={bpm} onChange={e => setBpm(+e.target.value)} /> {bpm}</label>
      {Object.entries(t("au.texture")).map(([k, v]) => <button key={k} className={texture === k ? "on" : ""} onClick={() => setTexture(k)}>{v}</button>)}
      <button className={voicing === "smooth" ? "on" : ""} onClick={() => setVoicing(voicing === "smooth" ? "close" : "smooth")} title={t("au.smoothTitle")}>{voicing === "smooth" ? t("au.smooth") : t("au.close")}</button>
      <button className={loop ? "on" : ""} onClick={() => setLoop(!loop)}>{t("au.loop")}</button>
    </div>
    {tz && <Tonnetz cols={10} rows={5} unit={50} compact {...tz} path={items.map(i => i.sym ?? { name: i.full, notes: i.notes })} current={cur} />}
    {keyboard && <Keyboard from="C2" to="B5" names="C" height={80} />}
    {caption && <div className="au-hint" style={{ marginTop: 6 }}>{caption}</div>}
  </div>;
}

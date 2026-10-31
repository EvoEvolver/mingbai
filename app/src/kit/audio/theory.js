// 乐理工具（纯函数，无声音）。音高用 MIDI 编号（C4 = 60），音级 pc = 0..11（C = 0）。

export const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
export const isBlack = pc => [1, 3, 6, 8, 10].includes(((pc % 12) + 12) % 12);
export const mod12 = n => ((n % 12) + 12) % 12;

// 音名显示。spell: "sharp" | "flat" | "both"（黑键显示 C♯/D♭ 两种）
export function pcName(pc, spell = "both") {
  pc = mod12(pc);
  if (!isBlack(pc) || spell === "sharp") return SHARP[pc];
  if (spell === "flat") return FLAT[pc];
  return SHARP[pc] + "/" + FLAT[pc];
}

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "C#4" "Eb3" "F♯" "Bb" → MIDI；省略八度时用 octave（默认 4）
export function parseNote(s, octave = 4) {
  if (typeof s === "number") return s;
  const m = String(s).trim().match(/^([A-Ga-g])([#♯b♭x]*)(-?\d+)?$/);
  if (!m) throw new Error("无法解析音名：" + s);
  let pc = LETTER[m[1].toUpperCase()];
  for (const a of m[2]) pc += a === "#" || a === "♯" ? 1 : a === "x" ? 2 : -1;
  return pc + 12 * ((m[3] !== undefined ? +m[3] : octave) + 1);
}
// "C4 E4 G4" 或 ["C4","E4"] → [60,64,67]
export const parseNotes = s => (Array.isArray(s) ? s : String(s).split(/[\s,]+/).filter(Boolean)).map(n => parseNote(n));

// 和弦符号 → 半音结构（相对根音）
export const CHORD_TYPES = {
  "": [0, 4, 7], maj: [0, 4, 7], M: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], "-": [0, 3, 7],
  dim: [0, 3, 6], "°": [0, 3, 6], aug: [0, 4, 8], "+": [0, 4, 8],
  "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], "Δ": [0, 4, 7, 11], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  "ø": [0, 3, 6, 10], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], "°7": [0, 3, 6, 9], mM7: [0, 3, 7, 11],
  sus4: [0, 5, 7], sus2: [0, 2, 7], "6": [0, 4, 7, 9], m6: [0, 3, 7, 9], "5": [0, 7],
  // 变化七和弦
  "7b5": [0, 4, 6, 10], "7#5": [0, 4, 8, 10], "+7": [0, 4, 8, 10], aug7: [0, 4, 8, 10], "7sus4": [0, 5, 7, 10],
  "+Δ": [0, 4, 8, 11], "+maj7": [0, 4, 8, 11], augmaj7: [0, 4, 8, 11], "maj7#5": [0, 4, 8, 11], "Δ#5": [0, 4, 8, 11],
  // 高叠（延伸）和弦
  "7b9": [0, 4, 7, 10, 13], "7#9": [0, 4, 7, 10, 15], "7#11": [0, 4, 7, 10, 18], "7b13": [0, 4, 7, 10, 20],
  "9": [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], "Δ9": [0, 4, 7, 11, 14], M9: [0, 4, 7, 11, 14],
  "11": [0, 4, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], "13": [0, 4, 7, 10, 14, 21], m13: [0, 3, 7, 10, 14, 21],
  maj13: [0, 4, 7, 11, 14, 21], "Δ13": [0, 4, 7, 11, 14, 21], "7alt": [0, 4, 10, 13, 15, 20], alt: [0, 4, 10, 13, 15, 20],
  add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], "69": [0, 4, 7, 9, 14], "6/9": [0, 4, 7, 9, 14],
  // 增六和弦（以低音为「根音」书写：Ab It+6 = A♭–C–F♯）
  "It+6": [0, 4, 10], "Fr+6": [0, 4, 6, 10], "Ger+6": [0, 4, 7, 10], "Gr+6": [0, 4, 7, 10],
};
// "C" "Em" "G7" "Bø" "F#dim7" → { root(MIDI), notes[], type, name }。根音默认放在 octave 八度
// 支持：类型中的 ♭/♯ 写法（G7♭9）、"no5"/"omit5" 后缀（省略五音）、斜线和弦 "C/E"（bass 为低音 MIDI，比和弦低一个八度以内）
export function parseChord(sym, octave = 4) {
  const [main, slash] = String(sym).trim().split("/").map(x => x && x.trim());
  if (slash !== undefined && /^\d/.test(slash)) return parseChord(main.replace(/6$/, "") + "69", octave);   // "C6/9" 不是斜线和弦
  const m = main.match(/^([A-G][#♯b♭]?)(.*)$/);
  let type = m ? m[2].replace(/♭/g, "b").replace(/♯/g, "#").replace(/[()]/g, "") : null, omit5 = false;
  if (type && /(no|omit)5$/.test(type)) { omit5 = true; type = type.replace(/(no|omit)5$/, ""); }
  if (!m || !(type in CHORD_TYPES)) throw new Error("无法解析和弦：" + sym);
  const root = parseNote(m[1], octave);
  let notes = CHORD_TYPES[type].map(i => root + i);
  if (omit5) notes = notes.filter(n => n - root !== 7);
  const out = { root, type, name: sym, notes };
  if (slash) { const b = parseNote(slash.match(/^[A-G][#♯b♭]?/)[0], octave); out.bass = b - 12 * Math.ceil((b - root + 1) / 12); }
  return out;
}
// 和弦的「三和弦核心」：大三/小三返回 {minor}，否则 null（减、增、挂留等）
export function triadCore(c) {
  const iv = c.notes.map(n => n - c.root);
  if (iv[2] !== 7 && !(iv.length === 2 && iv[1] === 7)) return null;
  if (iv[1] === 4) return { minor: false };
  if (iv[1] === 3) return { minor: true };
  return null;
}

// 八度内音程名（按半音数，取最常用写法）
export const INTERVALS = [
  { st: 0, zh: "纯一度", en: "Perfect unison" }, { st: 1, zh: "小二度", en: "Minor 2nd" },
  { st: 2, zh: "大二度", en: "Major 2nd" }, { st: 3, zh: "小三度", en: "Minor 3rd" },
  { st: 4, zh: "大三度", en: "Major 3rd" }, { st: 5, zh: "纯四度", en: "Perfect 4th" },
  { st: 6, zh: "三全音（增四度/减五度）", en: "Tritone" }, { st: 7, zh: "纯五度", en: "Perfect 5th" },
  { st: 8, zh: "小六度", en: "Minor 6th" }, { st: 9, zh: "大六度", en: "Major 6th" },
  { st: 10, zh: "小七度", en: "Minor 7th" }, { st: 11, zh: "大七度", en: "Major 7th" },
  { st: 12, zh: "纯八度", en: "Perfect octave" },
];
export const intervalName = st => (st >= 0 && st <= 12 ? INTERVALS[st].zh : st > 12 ? "复音程（" + INTERVALS[st % 12 || 12].zh + " + 八度）" : "");

// 频率。tuning: "equal"（十二平均律）| "just"（相对 ref 的纯律比值）
export const JUST = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];
export const JUST_LABEL = ["1", "16/15", "9/8", "6/5", "5/4", "4/3", "45/32", "3/2", "8/5", "5/3", "9/5", "15/8"];
export function freq(midi, tuning = "equal", ref = 60) {
  if (tuning !== "just") return 440 * 2 ** ((midi - 69) / 12);
  const d = midi - ref, oct = Math.floor(d / 12);
  return 440 * 2 ** ((ref - 69) / 12) * JUST[mod12(d)] * 2 ** oct;
}

// 从 start 出发、每步 step 个半音的循环（直到回到起点）
export function cycle(start, step) {
  const out = [mod12(start)];
  for (let p = mod12(start + step); p !== out[0]; p = mod12(p + step)) out.push(p);
  return out;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const cycleCount = step => gcd(12, mod12(step)) || 12;   // 互不相同的循环有几组

// Tonnetz（与《图解和声》同向：横向 +7 纯五度，右上 +4 大三度，左上 −3 小三度）
// 格点 (i, j)：i 沿横线，j 向上；音级 = origin + 7i + 4j；屏幕 x = i + j/2
export const tonnetzPc = (i, j, origin = 0) => mod12(origin + 7 * i + 4 * j);
// 朝上三角 (i,j)-(i+1,j)-(i,j+1) 为大三和弦，根音为 (i,j)；朝下三角 (i+1,j)-(i,j+1)-(i+1,j+1) 为小三和弦，根音为 (i,j+1)
export function triadName(rootPc, minor, spell = "flat") {
  const n = pcName(rootPc, spell);
  return minor ? n + "m" : n;
}

// 级数记号：romanOf("G7", "C") → "V7"；romanOf("Bdim", "C") → "vii°"；小调用 "Am" 表示（自然小调音级）
const ROM = ["I", "II", "III", "IV", "V", "VI", "VII"];
const LETTERS = "CDEFGAB";
// 按字母算级数（B♭ 在 C 大调是 ♭VII，F♯m 是 ♯iv）；小调中升高的 6、7 级（旋律/和声小调）不加升号：G♯° 在 a 小调为 vii°
export function romanOf(sym, key = "C") {
  const k = String(key).match(/^([A-G][#♯b♭]?)(m?)$/); if (!k) return "";
  const minor = !!k[2], tonic = mod12(parseNote(k[1]));
  const scale = minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const c = parseChord(sym), rootName = String(sym).trim().match(/^[A-G][#♯b♭]?/)[0];
  const deg = (LETTERS.indexOf(rootName[0]) - LETTERS.indexOf(k[1][0]) + 7) % 7;
  let diff = mod12(c.root - tonic - scale[deg]); if (diff > 6) diff -= 12;
  if (minor && (deg === 5 || deg === 6) && diff === 1) diff = 0;
  const acc = diff > 0 ? "♯".repeat(diff) : "♭".repeat(-diff);
  const iv = c.notes.map(n => n - c.root), minorish = iv[1] === 3, dim = iv[1] === 3 && iv[2] === 6, aug = iv[1] === 4 && iv[2] === 8;
  let r = ROM[deg]; if (minorish) r = r.toLowerCase();
  const suffix = { "": "", m: "", min: "", dim: "°", "°": "°", aug: "+", "+": "+", "7": "7", maj7: "maj7", "Δ": "maj7", M7: "maj7", m7: "7", "ø": "ø7", m7b5: "ø7", dim7: "°7", "°7": "°7", sus4: "sus4", sus2: "sus2", "6": "6", m6: "6", mM7: "(maj7)" }[c.type];
  return acc + r + (suffix ?? (dim ? "°" : aug ? "+" : c.type));
}

// 和弦配置（voicing）。close：原位密集排列，根音落在 [lo, lo+11]；smooth：在所有转位中选离 prev 最近的
export function voiceChord(sym, { prev, lo = 55, style = "close" } = {}) {
  const c = parseChord(sym); const pcs = c.notes.map(mod12);
  const root = lo + mod12(pcs[0] - lo);
  const close = c.notes.map(n => n - c.root + root);
  if (style !== "smooth" || !prev) return close;
  let best = close, bestCost = Infinity;
  for (let inv = 0; inv < pcs.length; inv++) {
    for (const base of [lo - 12, lo, lo + 12]) {
      const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
      // 从 base 起向上依次叠放：每个音取「高于前一个音的最近同名音」
      const v = [base + mod12(order[0] - base)];
      for (const pc of order.slice(1)) { const last = v[v.length - 1]; v.push(last + (mod12(pc - last) || 12)); }
      if (v[0] < lo - 7 || v[v.length - 1] > lo + 19) continue;
      const cost = v.reduce((s, x, i) => s + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0);
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
  }
  return best;
}

// 和弦符号的显示形式：根音与低音的 b/# 改为 ♭/♯，增六和弦与根音之间加空格（"AbIt+6" → "A♭ It+6"，"Bb7/F" → "B♭7/F"）
export function prettyChord(sym) {
  return String(sym).replace(/(^|\/)([A-G])([#b]?)/g, (m, pre, l, a) => pre + l + (a === "b" ? "♭" : a === "#" ? "♯" : ""))
    .replace(/(\d)b(\d)/g, "$1♭$2").replace(/(\d)#(\d)/g, "$1♯$2").replace(/^([A-G][♭♯]?)(It|Fr|Ger|Gr)\+6/, "$1 $2+6");
}

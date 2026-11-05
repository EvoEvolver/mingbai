import { t } from "../i18n/index.js";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import { book, modules, pageUrl, assetUrl, anchors, chapterNo } from "../book.jsx";
import { buildTable, annotate, symKey } from "./sym.js";

// ---------- KaTeX rendering ----------
// Book-level macros are defined in katexMacros in book.js (e.g. "\\H": "\\mathcal{H}"). Macros are read on first render
// (to avoid triggering the circular import with virtual:book during module initialization).
let MACROS = null, MACRO_RE = null;
function macros() {
  if (!MACROS) {
    // \sym{id}{…}/\nosym{…} are handled by annotate on chapter pages with a symbol table; elsewhere (shelf, cross-chapter previews, etc.) they render as plain content
    MACROS = { ...(book?.katexMacros || {}) };
    // Pre-expansion targets only book-level macros (\\sym/\\nosym must stay intact for annotate to recognize)
    const names = Object.keys(book?.katexMacros || {}).map(k => k.replace(/^\\/, "")).sort((a, b) => b.length - a.length);
    MACRO_RE = names.length ? new RegExp(`\\\\(${names.join("|")})(?![a-zA-Z])`, "g") : null;
  }
  return MACROS;
}
// Expand book-level macros (symbol recognition needs the expanded source, e.g. \Om → \Omega_{\mathrm{m}})
export function expandMacros(tex) {
  const M = macros(); if (!MACRO_RE) return tex;
  let s = tex;
  for (let k = 0; k < 3; k++) { const n = s.replace(MACRO_RE, (_, name) => M["\\" + name]); if (n === s) break; s = n; }
  return s;
}

// Current chapter's symbol table (set by TextbookProvider during render; only one chapter is shown at a time)
let ACTIVE = { table: null, ver: 0 };
const cache = new Map(), usedCache = new Map();
const trust = c => ["\\htmlData", "\\htmlClass"].includes(c.command);

export function renderTex(tex, display = false) {
  const key = ACTIVE.ver + (display ? "D" : "I") + tex;
  if (cache.has(key)) return cache.get(key);
  macros();
  let src = tex;
  if (ACTIVE.table) { const r = annotate(expandMacros(tex), ACTIVE.table); src = r.tex; usedCache.set(ACTIVE.ver + tex, r.used); }
  // \sym{id}{…} / \nosym{…} not handled by annotate (pages without a symbol table, or in unrecognized positions): strip the markup, keep the content
  src = src.replace(/\\sym\{[^{}]*\}/g, "").replace(/\\nosym(?![a-zA-Z])/g, "");
  let html;
  try {
    html = katex.renderToString(src, { displayMode: display, throwOnError: true, macros: { ...MACROS }, strict: "ignore", trust, output: "html" });
  } catch (e) {
    // Render failure: show the source in red; the self-check script counts .tex-error
    html = `<span class="tex-error" title="${String(e.message).replace(/"/g, "&quot;")}">${tex.replace(/</g, "&lt;")}</span>`;
  }
  cache.set(key, html);
  return html;
}
// Symbol ids used in a formula
export function symbolsIn(tex) {
  if (!ACTIVE.table) return [];
  const k = ACTIVE.ver + tex;
  if (!usedCache.has(k)) usedCache.set(k, annotate(expandMacros(tex), ACTIVE.table).used);
  return [...usedCache.get(k)];
}

// Inline equation: <M>{String.raw`\dot a/a`}</M>
export const M = ({ children }) => <span className="m" dangerouslySetInnerHTML={{ __html: renderTex(String(children)) }} />;

// ---------- Auto-fit scaling ----------
// Scale the KaTeX content in the ref element to fit the element itself: KaTeX uses em units, so adjusting font-size scales proportionally.
// both=true also fits the height (for fixed-size nodes). Scrolling remains if it still doesn't fit at min.
export function useFit(ref, deps = [], { min = 0.7, both = false } = {}) {
  useLayoutEffect(() => {
    const box = ref.current; if (!box) return;
    // Measure using the actual bounding boxes of .katex-html fragments (centered content overflows both sides; scrollWidth counts only the right, so it's unreliable)
    const measure = () => {
      const h = box.querySelector(".katex-html"); if (!h) return null;
      let l = Infinity, r = -Infinity;
      for (const c of h.children) { const b = c.getBoundingClientRect(); if (b.width) { l = Math.min(l, b.left); r = Math.max(r, b.right); } }
      return r > l ? { w: r - l, h: h.getBoundingClientRect().height } : null;
    };
    const fit = () => {
      box.style.fontSize = "";
      const base = parseFloat(getComputedStyle(box).fontSize);       // original font size in pixels
      // Available size also uses getBoundingClientRect: same coordinate system as the content measurement, so transform scaling during animations doesn't distort the ratio
      const bb = box.getBoundingClientRect(), sx = box.clientWidth ? bb.width / box.clientWidth : 1;
      const aw = bb.width - 4 * sx, ah = bb.height - 4 * sx;
      let sc = 1;
      for (let it = 0; it < 3; it++) {                                  // iterative calibration (line height and spacing aren't strictly linear)
        const m = measure(); if (!m) return;
        let k = m.w > aw && aw > 0 ? aw / m.w : 1;
        if (both && m.h > ah && ah > 0) k = Math.min(k, ah / m.h);
        if (k >= 0.995) break;
        sc = Math.max(min, sc * k * 0.98);
        box.style.fontSize = base * sc + "px";
        if (sc === min) break;
      }
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => live && fit());     // sizes change once the KaTeX fonts load
    const ro = new ResizeObserver(() => fit()); ro.observe(box);
    return () => { live = false; ro.disconnect(); };
  }, deps);   // eslint-disable-line
}

// Display equation layout: equation area + number column (no KaTeX \tag: long equations would overlap the absolutely positioned number).
// Too-wide equations shrink automatically (down to min), then scroll horizontally in the equation area; the number always has its own column on the right.
export function EqLine({ tex, n, min = 0.6, className = "" }) {
  const ref = useRef(null);
  const html = renderTex(tex, true);
  useFit(ref, [html], { min });
  return (
    <div className={"eqline " + className}>
      <div className="eqline-m" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {n && <div className="eqline-n">({n})</div>}
    </div>);
}

// Inline equation auto-fit (for fixed-width small cards/nodes)
export function FitTex({ tex, display = false, min = 0.4, both = false, className = "" }) {
  const ref = useRef(null);
  const html = renderTex(tex, display);
  useFit(ref, [html], { min, both });
  return <div className={"fittex " + className} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- Textbook context: equation registry + symbol dictionary ----------
const TbCtx = createContext(null);
export const useTextbook = () => useContext(TbCtx);

let tableVer = 0;
// notation: this chapter's symbol table [{sym, name, def, eq, unit, id?}]; notation exported by other chapters is merged too (this chapter takes priority)
export function TextbookProvider({ chapterId, notation = [], children }) {
  const eqs = useRef(new Map());              // n -> {tex, key, title, say}
  const [ver, setVer] = useState(0);
  const [pop, setPop] = useState(null);       // symbol popover {id, x, y}
  const [modal, setModal] = useState(null);   // equation zoom {tex, n, title, say}

  // Symbol table: this chapter first, then the others (ids are numbered across the whole book)
  const sym = useMemo(() => {
    const slug = (ch, s) => (ch + "-" + s).replace(/[^A-Za-z0-9]+/g, "_");
    const all = [];
    // Automatic ids derive from the symbol; different symbols may produce the same slug (e.g. D_+ and D_-), so duplicates get a numeric suffix to stay unique
    const taken = new Set();
    const uniq = id => { let u = id, k = 2; while (taken.has(u)) u = id + "_" + k++; taken.add(u); return u; };
    const push = (ch, list) => (list || []).filter(Boolean).forEach(e => all.push({ ...e, chapter: ch, id: uniq(e.id ? ch + "-" + e.id : slug(ch, e.sym)) }));
    push(chapterId, notation);
    for (const c of book.chapters) if (c.id !== chapterId) push(c.id, modules[c.id]?.notation);
    const byId = Object.fromEntries(all.map(e => [e.id, e]));
    // Common ambiguous single letters (e as Euler's number/electron, d as differential/distance, π) use only this chapter's dictionary entries, to avoid mislabeling with another chapter's meaning
    const LOCAL_ONLY = new Set(["e|", "d|", "\\pi|"]);
    const usable = all.filter(e => e.chapter === chapterId || !LOCAL_ONLY.has(symKey(expandMacros(e.sym))));
    return { table: buildTable(usable, expandMacros), byId };
  }, [chapterId, notation]);
  // Set the current symbol table synchronously during render (takes effect as child components render next)
  if (ACTIVE.table !== sym.table) ACTIVE = { table: sym.table, ver: ++tableVer };

  // Child effects run before the parent's: the registry is complete by now, so refresh the components that depend on it once (roadmap, key equations, etc.)
  useEffect(() => { setVer(v => v + 1); }, []);

  // Click delegation: symbol → popover; equation → zoom
  useEffect(() => {
    const onClick = e => {
      const s = e.target.closest?.("[data-sym]");
      if (s && s.closest(".tb, .tb-modal, .fm-panel")) {
        e.preventDefault(); e.stopPropagation();
        const r = s.getBoundingClientRect();
        setPop({ id: s.dataset.sym, x: r.left + r.width / 2, y: r.bottom, top: r.top });
        return;
      }
      if (e.target.closest?.(".sym-pop")) return;
      setPop(null);
      const q = e.target.closest?.("[data-eqtex]");
      if (q && !e.target.closest("a, button") && !window.getSelection()?.toString()) {
        const n = q.dataset.eqn || null;
        const info = n ? eqs.current.get(n) : null;
        setModal({ tex: q.dataset.eqtex, n, title: info?.title || q.dataset.eqtitle, say: info?.say || q.dataset.eqsay });
      }
    };
    const onKey = e => { if (e.key === "Escape") { setPop(null); setModal(null); } };
    document.addEventListener("click", onClick, true);
    addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick, true); removeEventListener("keydown", onKey); };
  }, []);

  const value = useMemo(() => ({
    chapterId, eqs, sym,
    register: (n, info) => { eqs.current.set(n, info); },
    openEq: info => setModal(info),
    version: ver,
  }), [chapterId, ver, sym]);
  return (
    <TbCtx.Provider value={value}>
      {children}
      {pop && <SymbolPop {...pop} onClose={() => setPop(null)} />}
      {modal && <EqModal {...modal} onClose={() => setModal(null)} />}
    </TbCtx.Provider>);
}

// Number → chapter id ("2.23" → ch02, "A.3" → appA)
// Books whose numbers don't contain the chapter (papers, section-numbered textbooks): declare eqs on the chapter in book.js, as a regex string (e.g. "^[A-F]-\\d+") or true (fallback: all remaining numbers are on this page)
// Numbers in split chapters (ch07 / ch07b) are resolved by the anchors table scanned at build time (kind: eq / fig / sec)
export function chapterOfNum(n, kind = "eq") {
  const hit = anchors?.[`${kind}:${n}`];
  if (hit) return hit;
  const head = String(n).split(".")[0];
  const byNo = /^\d+$/.test(head) ? book.chapters.find(c => String(c.no) === head && c.no !== 0)?.id : book.chapters.find(c => c.id === "app" + head)?.id;
  if (byNo) return byNo;
  const own = book.chapters.find(c => typeof c.eqs === "string" && new RegExp(c.eqs).test(String(n))) || book.chapters.find(c => c.eqs === true);
  return own?.id;
}
const anchor = (kind, n) => `${kind}-${String(n).replace(/[^\w.-]/g, "_")}`;
const hrefTo = (kind, n, here) => pageUrl(chapterOfNum(n, kind) || here, anchor(kind, n));
const chapterName = id => { const c = book.chapters.find(x => x.id === id); return c ? chapterNo(c) : id; };

// ---------- Symbol popover ----------
function SymbolPop({ id, x, y, top, onClose }) {
  const tb = useTextbook();
  const e = tb.sym.byId[id] || tb.sym.byId[tb.chapterId + "-" + id];   // \sym{} can use this chapter's short id
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y + 8 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = Math.min(Math.max(8, x - w / 2), innerWidth - w - 8), t = y + 8;
    if (t + h > innerHeight - 8) t = Math.max(8, top - h - 8);
    setPos({ left, top: t });
  }, [x, y, top, id]);
  if (!e) return null;
  // Equations in this chapter that use the symbol
  const uses = [...tb.eqs.current.entries()].filter(([, v]) => v.used?.includes(id)).map(([n]) => n)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return (
    <div className="sym-pop" ref={ref} style={pos} role="dialog">
      <button className="sym-x" onClick={onClose} aria-label={t("ui.close")}>×</button>
      <div className="sym-head">
        <span className="sym-big" dangerouslySetInnerHTML={{ __html: katex.renderToString(expandMacros(e.sym), { throwOnError: false, macros: { ...macros() } }) }} />
        <span><b><Rich>{e.name}</Rich></b>{e.en && <i className="muted"> {e.en}</i>}</span>
      </div>
      {e.def && <div className="sym-def"><TxI>{e.def}</TxI></div>}
      {e.unit && <div className="sym-row"><span>{t("sym.unit")}</span><TxI>{e.unit}</TxI></div>}
      {e.eq && <div className="sym-row"><span>{t("sym.defined")}</span><EqRef n={e.eq} />{e.chapter !== tb.chapterId && <span className="muted">{t("p.paren", chapterName(e.chapter))}</span>}</div>}
      {uses.length > 0 && <div className="sym-row"><span>{t("sym.uses")}</span><span className="sym-uses">{uses.slice(0, 12).map(n => <EqRef key={n} n={n} />)}{uses.length > 12 && <span className="muted">{t("sym.more", uses.length)}</span>}</span></div>}
    </div>);
}

// ---------- Equation zoom + symbol-by-symbol reading ----------
function EqModal({ tex, n, title, say, onClose }) {
  const tb = useTextbook();
  const ids = symbolsIn(tex);
  const [copied, setCopied] = useState(false);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  return (
    <div className="tb-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tb-modal-card" role="dialog">
        <button className="close" onClick={onClose} aria-label={t("ui.close")}>×</button>
        <div className="tb-modal-h">{n ? t("eq.n", n) : t("eq.formula")}{title && <> · <Rich>{title}</Rich></>}</div>
        <div className="tb-modal-eq"><EqLine tex={tex} n={n} min={0.45} /></div>
        {say && <div className="tb-modal-say">🗣 <TxI>{say}</TxI></div>}
        {ids.length > 0 && <>
          <div className="tb-modal-sub">{t("eq.symbols")}</div>
          <table className="tb-table tb-symlist"><tbody>{ids.map(id => {
            const e = tb.sym.byId[id] || tb.sym.byId[tb.chapterId + "-" + id]; if (!e) return null;
            return <tr key={id}>
              <td className="sym-cell" dangerouslySetInnerHTML={{ __html: katex.renderToString(expandMacros(e.sym), { throwOnError: false, macros: { ...macros() } }) }} />
              <td><b><Rich>{e.name}</Rich></b></td><td><TxI>{e.def || ""}</TxI>{e.eq && <> · {t("eq.see")} <EqRef n={e.eq} /></>}</td>
            </tr>;
          })}</tbody></table>
        </>}
        <div className="tb-modal-tools">
          {n && <a href={hrefTo("eq", n, tb.chapterId)} onClick={() => onClose()}>{t("eq.locate")}</a>}
          <button onClick={() => { navigator.clipboard?.writeText(tex); setCopied(true); }}>{copied ? t("ui.copied") : t("eq.copyTex")}</button>
        </div>
      </div>
    </div>);
}

// Display equation (numbered as in the source book).
// <Eq n="2.23" keyEq title="Christoffel symbols" say="one-line reading">{String.raw`…`}</Eq>
// keyEq: key equation (highlighted + in the end-of-chapter summary); say: what the equation says, in words (shown in the zoom window).
// Omit n for unnumbered display equations. For multiple lines use \begin{aligned}…\end{aligned}. Click an equation to zoom, click a symbol to see its definition.
// Add a numbered equation to the chapter's registry, for \\eqref, hover previews, and KeyEquations
export function useRegisterEq(n, tex, { keyEq = false, title, say } = {}) {
  const tb = useTextbook();
  if (n && tb) tb.register(String(n), { tex, key: keyEq, title, say, used: symbolsIn(tex) });
}

export function Eq({ n, children, keyEq = false, title, say }) {
  const tb = useTextbook();
  const tex = String(children).trim();
  useRegisterEq(n, tex, { keyEq, title, say });
  return (
    <div className={"eq" + (keyEq ? " eq-key" : "") + (tb ? " eq-click" : "")} id={n ? anchor("eq", n) : undefined}
      data-eqtex={tb ? tex : undefined} data-eqn={n || undefined} data-eqtitle={title || undefined} data-eqsay={say || undefined}>
      {keyEq && title && <div className="eq-title"><Rich>{title}</Rich></div>}
      <EqLine tex={tex} n={n} className="eq-body" />
      {tb && <span className="eq-zoom" title={t("eq.zoomTitle")}>⤢</span>}
    </div>);
}

// References: equations (with hover preview), figures, sections, exercises
// Hover preview: rendered into document.body (portal) with fixed positioning from the trigger's screen position, so
// no overflow container (horizontally scrolling tables, cards, etc.) clips it; pops downward when there's too little room above, and stays within the viewport horizontally.
export function HoverPop({ anchor, className = "", children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  useLayoutEffect(() => {
    const a = anchor?.getBoundingClientRect(), el = ref.current; if (!a || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight, gap = 8;
    const left = Math.min(Math.max(8, a.left + a.width / 2 - w / 2), innerWidth - w - 8);
    const top = a.top - h - gap >= 8 ? a.top - h - gap : Math.min(a.bottom + gap, innerHeight - h - 8);
    setPos({ left, top: Math.max(8, top) });
  }, [anchor]);
  return createPortal(<span ref={ref} className={"ref-pop floating " + className} style={pos}>{children}</span>, document.body);
}

function Ref({ kind, n, label, preview }) {
  const tb = useTextbook();
  const [show, setShow] = useState(false);
  const wrap = useRef(null);
  const href = hrefTo(kind, n, tb?.chapterId);
  return (
    <span className="ref-wrap" ref={wrap} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <a className={"ref ref-" + kind} href={href} onClick={e => {
        const here = chapterOfNum(n, kind) === tb?.chapterId || !chapterOfNum(n, kind);
        const el = document.getElementById(anchor(kind, n));
        if (here && el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
      }}>{label}</a>
      {show && preview && <HoverPop anchor={wrap.current}>{preview()}</HoverPop>}
    </span>);
}
export function EqRef({ n, paren = true }) {
  const tb = useTextbook();
  const preview = () => {
    const info = tb?.eqs.current.get(String(n));
    if (!info) return <span className="muted">{t("eq.jump", chapterName(chapterOfNum(n)), n)}</span>;
    return <EqLine tex={info.tex} n={n} min={0.5} />;
  };
  return <Ref kind="eq" n={n} label={paren ? `(${n})` : n} preview={preview} />;
}
export const FigRef = ({ n }) => <Ref kind="fig" n={n} label={t("fig.n", n)} preview={() => <img src={assetUrl(`figures/fig-${n}.png`)} alt="" style={{ maxWidth: 360, display: "block" }} />} />;
export const SecRef = ({ n }) => <Ref kind="sec" n={n} label={`§${n}`} />;
export const ExRef = ({ n }) => <Ref kind="ex" n={n} label={t("ex.n", n)} />;
export { anchor };

// ---------- Body text with formulas ----------
// <Tx>{String.raw`The scale factor $a(t)$ satisfies \eqref{2.23}, see \figref{2.3}, \secref{2.1.1}, \exref{2.4}. **bold** *emphasis*`}</Tx>
// Blank lines separate paragraphs; $$...$$ is an unnumbered display equation (also clickable to zoom).
// Inline notation. Books can register their own reference notation with extendInline (e.g. \sref{L2.1} in paper books), which then works everywhere formulas are supported.
const BASE_TOKENS = [String.raw`\$\$[\s\S]+?\$\$`, String.raw`\$[^$]+?\$`, String.raw`\\eqref\{[^}]+\}`, String.raw`\\figref\{[^}]+\}`, String.raw`\\secref\{[^}]+\}`, String.raw`\\exref\{[^}]+\}`, String.raw`\*\*[^*]+?\*\*`, String.raw`\*[^*\s][^*]*?\*`];
const EXT = [];       // [{ name, render(arg, key) }]: notation of the form \name{arg}
let TOKEN = new RegExp(`(${BASE_TOKENS.join("|")})`, "g");
let RICH = /\$[^$]+\$|\\(eqref|figref|secref|exref)\{/;      // only strings containing these notations are parsed as "rich text" (see Rich)
export function extendInline(name, render) {
  if (EXT.some(e => e.name === name)) return;
  EXT.push({ name, render });
  const ext = EXT.map(e => String.raw`\\${e.name}\{[^}]+\}`);
  TOKEN = new RegExp(`(${[...ext, ...BASE_TOKENS].join("|")})`, "g");
  RICH = new RegExp(String.raw`\$[^$]+\$|\\(eqref|figref|secref|exref|${EXT.map(e => e.name).join("|")})\{`);
}
function inline(text, keyBase) {
  return String(text).split(TOKEN).filter(s => s !== "").map((s, i) => {
    const k = keyBase + "-" + i;
    if (s.startsWith("$$")) { const t = s.slice(2, -2); return <span key={k} className="eq eq-inline-block eq-click" data-eqtex={t}><EqLine tex={t} /></span>; }
    if (s.startsWith("$")) return <span key={k} className="m" dangerouslySetInnerHTML={{ __html: renderTex(s.slice(1, -1)) }} />;
    let m;
    for (const e of EXT) if ((m = s.match(new RegExp(String.raw`^\\${e.name}\{(.+)\}$`)))) return <span key={k}>{e.render(m[1], k)}</span>;
    if ((m = s.match(/^\\eqref\{(.+)\}$/))) return <EqRef key={k} n={m[1]} />;
    if ((m = s.match(/^\\figref\{(.+)\}$/))) return <FigRef key={k} n={m[1]} />;
    if ((m = s.match(/^\\secref\{(.+)\}$/))) return <SecRef key={k} n={m[1]} />;
    if ((m = s.match(/^\\exref\{(.+)\}$/))) return <ExRef key={k} n={m[1]} />;
    if (s.startsWith("**")) return <b key={k}>{inline(s.slice(2, -2), k)}</b>;
    if (s.startsWith("*") && s.length > 2) return <em key={k}>{inline(s.slice(1, -1), k)}</em>;
    return s;
  });
}
export function Tx({ children, as = "p", className }) {
  const text = String(children ?? "");
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const Tag = as;
  if (as !== "p") return <Tag className={className}>{inline(text.trim(), "t")}</Tag>;
  return paras.map((p, i) => <p key={i} className={className}>{inline(p.replace(/\s*\n\s*/g, " "), "p" + i)}</p>);
}
// Parses only inline markup, without splitting paragraphs (for titles, table cells, buttons, etc.)
export const TxI = ({ children }) => <>{inline(String(children ?? ""), "i")}</>;

// ---------- Rich text: parse formulas only when needed ----------
// Strings containing $…$ or \eqref-style notation render via TxI/Tx (KaTeX + references), otherwise as is, so formula-free humanities text is completely unaffected.
// Non-strings (JSX) are returned as is. Places in the framework that originally rendered only plain text (Hook, Bridge, concept cards, Takeaways, Quiz, Roadmap, Plot captions, shelf…) all go through it.
export const needsRich = s => typeof s === "string" && RICH.test(s);
export function Rich({ children }) {
  const s = children;
  if (typeof s !== "string") return s ?? null;
  return needsRich(s) ? <TxI>{s}</TxI> : s;
}
// Paragraph-split version (split on \n\n): replaces core.jsx's Paras
export function RichParas({ text }) {
  if (text != null && typeof text !== "string") return text;
  const t = String(text ?? "");
  if (needsRich(t)) return <Tx>{t}</Tx>;
  return t.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>);
}
// For places that accept only plain text, such as title attributes: strips $ and \commands
export const plainText = s => (typeof s === "string" ? s.replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "") : "");

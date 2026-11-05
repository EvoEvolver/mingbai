import { t } from "../i18n/index.js";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Eq, Tx, TxI } from "../math/tex.jsx";

// Allocate page area by importance (see "Importance weighting" in spec/PAPER.md).
// Idea: in papers with equations, importance and area are often inverted: a key formula is the same size as three lines of routine algebra, and the assumption that decides the result hides in small print.
// So each piece of content gets a weight w ∈ {3, 2, 1}:
//   3 = must see (core result, key equation, decisive number, key assumption): enlarged, bold, with a color bar, and registered on the "importance map"
//   2 = body text (default)
//   1 = detail (routine derivations, side notes): smaller, gray; collapsed in "skim" mode
// Page level: <Weighted> provides the skim/deep-read toggle and the importance map on the right edge (PaperPage with weighted wraps it automatically).

const WCtx = createContext(null);
const useW = () => useContext(WCtx);

export function Weighted({ children }) {
  const [items, setItems] = useState([]);       // registered weight-3 items {id, label, kind}
  const [skim, setSkim] = useState(() => { try { return localStorage.getItem("pw-skim") === "1"; } catch { return false; } });
  useEffect(() => { document.body.classList.toggle("pw-skim", skim); try { localStorage.setItem("pw-skim", skim ? "1" : "0"); } catch { /* incognito mode */ } }, [skim]);
  const api = useRef({
    add: it => setItems(xs => (xs.some(x => x.id === it.id) ? xs : [...xs, it])),
    remove: id => setItems(xs => xs.filter(x => x.id !== id)),
  }).current;
  return (
    <WCtx.Provider value={{ ...api, items, skim, setSkim }}>
      {children}
      <SkimToggle />
      <ImportanceMap />
    </WCtx.Provider>);
}

// Register a weight-3 item: returns its anchor id
function useKey(label, kind, given) {
  const w = useW(); const auto = "k-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = given || auto;
  useEffect(() => { if (!w) return; w.add({ id, label, kind }); return () => w.remove(id); }, [id, label, kind]);
  return id;
}


// Paragraph: w=3 core claim / w=2 body / w=1 detail
// deep: body font size, but shown only in "deep read" mode (for interactive figures, long tables, side notes, and other blocks that shouldn't shrink but aren't needed when skimming)
export function P({ w = 2, label, id, deep, children }) {
  const body = typeof children === "string" ? <Tx>{children}</Tx> : children;
  if (w === 3) return <KeyPara label={label} id={id}>{body}</KeyPara>;
  return <div className={"pw pw-" + w + (deep ? " pw-deep" : "")}>{body}</div>;
}

// Register any existing component (Claim, KeyIdea, GapMap…) as a weight-3 item (added to the importance map), appearance unchanged
export function Key({ label, kind = "claim", id, children }) {
  const kid = useKey(label, kind, id);
  return <div className="pw-key" id={kid}>{children}</div>;
}
function KeyPara({ label, id, children }) {
  const kid = useKey(label || t("w.claim"), "claim", id);
  return <div className="pw pw-3" id={kid}>{children}</div>;
}

// Key equation: first say in large text what the equation says, then show it enlarged (it can still be opened for a symbol-by-symbol reading).
// parts: [{ tex, note }] — the parts of the equation most worth watching (optional)
export function BigEq({ n, meaning, label, say, parts, children }) {
  const kid = useKey(label || (n ? t("eq.n", n) : t("w.keyEq")), "eq");
  return (
    <div className="pw-bigeq" id={kid}>
      {meaning && <div className="pw-mean"><TxI>{meaning}</TxI></div>}
      <div className="pw-bigeq-eq"><Eq n={n} keyEq title={label} say={say || meaning}>{children}</Eq></div>
      {parts?.length > 0 && <div className="pw-parts">{parts.map((p, i) => <span key={i} className="pw-part"><TxI>{`$${p.tex}$`}</TxI><small><TxI>{p.note}</TxI></small></span>)}</div>}
    </div>);
}

// Minor equation: shown smaller, collapsed when skimming
export const MinorEq = props => <div className="pw pw-1 pw-mineq"><Eq {...props} /></div>;

// Routine derivation: a one-line collapsible bar, expand for details. Collapsed entirely when skimming.
// The content is always rendered (hidden when collapsed): numbered equations in it register as usual, so \eqref and symbol checks can find them;
// in-page links (\eqref, anchors) pointing at an element inside expand it automatically.
export function Fold({ title = t("der.title"), steps, note = t("w.skippable"), children }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    const inside = id => { try { return id && ref.current?.querySelector("#" + CSS.escape(id)); } catch { return null; } };
    const onClick = e => { const a = e.target.closest?.("a[href*='#']"); if (!a || ref.current?.contains(a)) return; const u = new URL(a.href, location.href);
      if (u.pathname === location.pathname && inside(u.hash.slice(1))) flushSync(() => setOpen(true)); };
    const onHash = () => { if (inside(decodeURIComponent(location.hash.slice(1)))) setOpen(true); };
    onHash(); document.addEventListener("click", onClick, true); addEventListener("hashchange", onHash);
    return () => { document.removeEventListener("click", onClick, true); removeEventListener("hashchange", onHash); };
  }, []);
  return (
    <div className={"pw-fold" + (open ? " open" : "")} ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "▾" : "▸"} <TxI>{title}</TxI>{steps ? ` · ${t("ui.steps", steps)}` : ""}<em>{note}</em></button>
      <div className="pw-fold-b" hidden={!open}>{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// Decisive number
export function Number({ value, label, why, id }) {
  const kid = useKey(`${value} ${label}`, "num", id);   // labels render with TxI, keeping $…$
  return (
    <div className="pw-num" id={kid}>
      <b><TxI>{String(value)}</TxI></b>
      <div><span><TxI>{label}</TxI></span>{why && <small><TxI>{why}</TxI></small>}</div>
    </div>);
}

// Key assumption / premise: papers often hide these in small print, so they're enlarged here
export function Assume({ title, children, id }) {
  const kid = useKey(title || t("w.assume"), "assume", id);
  return (
    <div className="pw-assume" id={kid}>
      <div className="pw-assume-h">⚠ {t("w.assume")}{title ? <>{t("p.colon")}<TxI>{title}</TxI></> : null}</div>
      <div>{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// Conclusion sentence: "So…"
export function Verdict({ children, label, id }) {
  const kid = useKey(label || t("box.result"), "verdict", id);
  return <div className="pw-verdict" id={kid}><span>{t("w.so")}</span>{typeof children === "string" ? <TxI>{children}</TxI> : children}</div>;
}

// First screen: the most important equation / number / assumption side by side at the top of the page
export const AboveFold = ({ title = t("w.above"), children }) => (
  <section className="pw-above" data-toc={t("w.aboveToc")}><div className="pw-above-h">{title}</div><div className="pw-above-g">{children}</div></section>);

// Skim / deep-read toggle
function SkimToggle() {
  const w = useW();
  return (
    <div className="pw-toggle" role="group" aria-label={t("w.mode")}>
      <button className={w.skim ? "on" : ""} onClick={() => w.setSkim(true)} title={t("w.skimTitle")}>{t("w.skim")}</button>
      <button className={!w.skim ? "on" : ""} onClick={() => w.setSkim(false)} title={t("w.readTitle")}>{t("w.read")}</button>
    </div>);
}

// Importance map: dots on a vertical bar at the right edge, placed by each weight-3 item's position on the page (current position highlighted)
function ImportanceMap() {
  const w = useW(); const [pos, setPos] = useState({}); const [cur, setCur] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const H = document.documentElement.scrollHeight, out = {};
      for (const it of w.items) { const el = document.getElementById(it.id); if (el) out[it.id] = (el.getBoundingClientRect().top + scrollY) / H; }
      setPos(out);
      const mid = scrollY + innerHeight * 0.55; let c = null;   // 0.55: aligned with block:"center" in go(), so the item whose dot was clicked becomes current after the jump
      for (const it of w.items) { const el = document.getElementById(it.id); if (el && el.getBoundingClientRect().top + scrollY <= mid) c = it.id; }
      setCur(c);
    };
    measure(); const t = setTimeout(measure, 600);
    addEventListener("scroll", measure, { passive: true }); addEventListener("resize", measure);
    const ro = new ResizeObserver(measure); ro.observe(document.body);
    return () => { clearTimeout(t); removeEventListener("scroll", measure); removeEventListener("resize", measure); ro.disconnect(); };
  }, [w.items, w.skim]);
  const sorted = [...w.items].filter(it => pos[it.id] != null).sort((a, b) => pos[a.id] - pos[b.id]);
  if (!sorted.length) return null;
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <div className="pw-map" aria-label={t("w.map")}>
      {sorted.map(it => <button key={it.id} className={"pw-dot k-" + it.kind + (cur === it.id ? " on" : "")} style={{ top: `${pos[it.id] * 100}%` }} onClick={() => go(it.id)} title={it.label.replace(/\$/g, "")} />)}
    </div>);
}

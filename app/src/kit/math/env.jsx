import { t } from "../i18n/index.js";
import { assetUrl } from "../book.jsx";
import { useState, useEffect, Children } from "react";
import { renderTex, EqLine, FitTex, Tx, TxI, Rich, plainText, anchor, useTextbook } from "./tex.jsx";

// ---------- Section heading ----------
// <Sec n="2.1" title="Expanding space" zh="Chinese title" gist="in one line: what this section achieves" why="why this step is needed" gives={["2.12","2.28"]}>
// gist/why/gives render as a "section key points" card at the start of the section (gives lists the key equation numbers the section produces, clickable to zoom).
export function Sec({ n, title, zh, gist, why, gives, children }) {
  return (
    <section className="tb-sec" id={anchor("sec", n)} data-toc={`${n} ${plainText(zh || title)}`}>
      <h2 className="tb-h2"><span className="tb-num">{n}</span> <Rich>{zh || title}</Rich>{zh && title && <small className="tb-en">{title}</small>}</h2>
      {(gist || why || gives) && <SecCard gist={gist} why={why} gives={gives} />}
      {children}
    </section>);
}
function SecCard({ gist, why, gives }) {
  const tb = useTextbook();
  return (
    <div className="tb-seccard">
      {gist && <div className="tb-sc-gist"><span className="tb-sc-lab">{t("sec.gist")}</span><TxI>{gist}</TxI></div>}
      {why && <div className="tb-sc-why"><span className="tb-sc-lab">{t("sec.why")}</span><TxI>{why}</TxI></div>}
      {gives?.length > 0 && <div className="tb-sc-gives"><span className="tb-sc-lab">{t("sec.gives")}</span>{gives.map(n => <EqChip key={n} n={n} tb={tb} />)}</div>}
    </div>);
}
// Small equation card (reads the registry; click to zoom)
export function EqChip({ n, tb: tb0, label }) {
  const tb = useTextbook() || tb0;
  const info = tb?.eqs.current.get(String(n));
  return (
    <span className="eq-chip" onClick={() => info && tb.openEq({ tex: info.tex, n, title: info.title, say: info.say })} title={t("ui.clickZoom")}>
      {label && <b>{label}</b>}
      {info && <FitTex tex={info.tex} min={0.45} className="eq-chip-m" />}<span className="eq-chip-n">({n})</span>
    </span>);
}
export function Sub({ n, title, zh, children }) {
  return (
    <section className="tb-sub" id={anchor("sec", n)} data-toc={`${n} ${plainText(zh || title)}`} data-toc-level="2">
      <h3 className="tb-h3"><span className="tb-num">{n}</span> <Rich>{zh || title}</Rich>{zh && title && <small className="tb-en">{title}</small>}</h3>
      {children}
    </section>);
}

// ---------- Environment boxes ----------
const KIND_ICONS = { definition: "📐", result: "✅", note: "📝", example: "🔎", physics: "💡", warning: "⚠️", aside: "📎", key: "🔑", data: "🔭" };
// <Box kind="physics" title="Why photon energy falls as 1/a">{String.raw`...body text with $formulas$...`}</Box> (children can also be JSX)
// n: optional number (e.g. the source book's "Example 5.12" → <Box kind="example" n="5.12">), shown as "Example 5.12" and creating the anchor example-5.12, which can be linked with pageUrl(…, "example-5.12") rather than \\exref
export function Box({ kind = "note", title, n, children }) {
  const k = KIND_ICONS[kind] ? kind : "note", icon = KIND_ICONS[k], label = t("box." + k);
  return (
    <div className={"tb-box tb-" + kind} id={n ? anchor(kind, n) : undefined}>
      <div className="tb-box-h">{icon} {label}{n && <> {n}</>}{title && <>{t("p.colon")}<TxI>{title}</TxI></>}</div>
      <div className="tb-box-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// ---------- Derivations ----------
// Each step: one line of formula + a reason. steps=[{tex, why}]; why supports $...$ and references.
// mode: fully expanded by default; stepwise reveals step by step. collapsed starts folded (long derivations).
export function Derivation({ title = t("der.title"), steps, collapsed = false, result }) {
  const [open, setOpen] = useState(!collapsed);
  const [stepwise, setStepwise] = useState(false);
  const [k, setK] = useState(1);
  const shown = stepwise ? steps.slice(0, k) : steps;
  return (
    <div className={"tb-deriv" + (open ? " open" : "")}>
      <div className="tb-deriv-h" onClick={() => setOpen(!open)}>
        <span>{open ? "▾" : "▸"} 🧮 <TxI>{title}</TxI></span>
        <span className="tb-deriv-meta">{t("ui.steps", steps.length)}{!open && t("ui.clickExpand")}</span>
      </div>
      {open && <>
        <div className="tb-deriv-tools">
          <button className={stepwise ? "" : "on"} onClick={() => setStepwise(false)}>{t("ui.showAll")}</button>
          <button className={stepwise ? "on" : ""} onClick={() => { setStepwise(true); setK(1); }}>{t("der.stepwise")}</button>
        </div>
        <ol className="tb-steps">{shown.map((s, i) =>
          <li key={i} className="tb-step">
            <div className="tb-step-m eq-click" data-eqtex={s.tex}><EqLine tex={s.tex} /></div>
            {s.why && <div className="tb-step-why"><TxI>{s.why}</TxI></div>}
          </li>)}
        </ol>
        {stepwise && <div className="tb-deriv-ctrl">
          <button disabled={k <= 1} onClick={() => setK(k - 1)}>{t("ui.prevStep")}</button>
          <span>{k} / {steps.length}</span>
          <button disabled={k >= steps.length} onClick={() => setK(k + 1)}>{t("ui.nextStep")}</button>
        </div>}
        {result && (!stepwise || k === steps.length) && <div className="tb-deriv-res">∴ <TxI>{result}</TxI></div>}
      </>}
    </div>);
}

// ---------- Figures ----------
// illustration is a hand-drawn figure (no source-book image requested); optional interactive, switched with tabs.
export function Figure({ n, caption, children, illustration, interactive, width = "100%", src }) {
  const [zoom, setZoom] = useState(false);
  const [tab, setTab] = useState(interactive ? 1 : 0);
  const img = assetUrl(src || `figures/fig-${n}.png`);
  useEffect(() => {
    if (!zoom) return;
    const k = e => e.key === "Escape" && setZoom(false);
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [zoom]);
  return (
    <figure className="tb-fig" id={anchor("fig", n)}>
      {interactive && <div className="seg tb-fig-tabs">
        <button className={tab === 0 ? "on" : ""} onClick={() => setTab(0)}>{illustration ? t("fig.own") : t("fig.original")}</button>
        <button className={tab === 1 ? "on" : ""} onClick={() => setTab(1)}>{t("fig.interactive")}</button>
      </div>}
      {tab === 0 || !interactive
        ? illustration
          ? <div className="tb-fig-int" data-illustration={n}>{illustration}</div>
          : <img src={img} alt={t("fig.n", n)} style={{ maxWidth: width }} onClick={() => setZoom(true)} title={t("ui.clickZoom")} loading="lazy" />
        : <div className="tb-fig-int">{interactive}</div>}
      <figcaption><b>{t("fig.n", n)}</b> <TxI>{caption}</TxI>{children}</figcaption>
      {zoom && <div className="tb-zoom" onClick={() => setZoom(false)}><img src={img} alt="" /></div>}
    </figure>);
}

// ---------- Exercises ----------
// <Exercise n="2.3" title="…" level="★★">{String.raw`problem text`}</Exercise>; hint / solution are strings or JSX;
// fromBook: the solution follows Appendix A of the source book (with attribution).
export function Exercise({ n, title, level, children, hint, solution, fromBook }) {
  const [h, setH] = useState(false), [s, setS] = useState(false);
  const body = x => (typeof x === "string" ? <Tx>{x}</Tx> : x);
  return (
    <div className="tb-ex" id={anchor("ex", n)}>
      <div className="tb-ex-h"><b>{t("ex.n", n)}</b>{title && <> · <TxI>{title}</TxI></>}{level && <span className="tb-ex-lv">{level}</span>}</div>
      <div className="tb-ex-b">{body(children)}</div>
      <div className="tb-ex-tools">
        {hint && <button onClick={() => setH(!h)}>{h ? t("ex.hideHint") : t("ex.hint")}</button>}
        {solution && <button onClick={() => setS(!s)}>{s ? t("ex.hideSolution") : t("ex.solution")}</button>}
      </div>
      {h && <div className="tb-ex-hint">{body(hint)}</div>}
      {s && <div className="tb-ex-sol">{fromBook && <div className="tb-ex-src">{t("ex.fromBook")}</div>}{body(solution)}</div>}
    </div>);
}

// ---------- Symbol table ----------
// rows: [{sym: "\\eta", name: "conformal time", def: "… (may contain $…$)", eq: "2.36"}]
export function Notation({ rows }) {
  const [q, setQ] = useState("");
  const list = rows.filter(r => !q || (r.sym + r.name + (r.def || "")).toLowerCase().includes(q.toLowerCase()));
  return <>
    {rows.length > 8 && <input className="search" placeholder={t("not.search")} value={q} onChange={e => setQ(e.target.value)} />}
    <table className="tb-table tb-notation"><thead><tr><th>{t("not.sym")}</th><th>{t("not.name")}</th><th>{t("not.def")}</th><th>{t("not.first")}</th></tr></thead>
      <tbody>{list.map((r, i) => <tr key={i}>
        <td dangerouslySetInnerHTML={{ __html: renderTex(r.sym) }} />
        <td><Rich>{r.name}</Rich></td><td><TxI>{r.def}</TxI></td><td>{r.eq ? <TxI>{`\\eqref{${r.eq}}`}</TxI> : ""}</td></tr>)}
      </tbody></table>
  </>;
}

// General table (cells support $…$). head: [..], rows: [[..],..]
export const Table = ({ head, rows, caption }) => (
  <div className="tb-table-wrap">
    <table className="tb-table">
      {head && <thead><tr>{head.map((h, i) => <th key={i}><TxI>{h}</TxI></th>)}</tr></thead>}
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><TxI>{c}</TxI></td>)}</tr>)}</tbody>
    </table>
    {caption && <div className="tb-table-cap"><TxI>{caption}</TxI></div>}
  </div>);

// Summary of this chapter's key equations (automatically collects Eq with k)
export function KeyEquations() {
  const tb = useTextbook();
  const [list, setList] = useState([]);
  useEffect(() => {
    setList([...tb.eqs.current.entries()].filter(([, v]) => v.key).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })));
  }, [tb.version]);
  if (!list.length) return null;
  return (
    <div className="tb-keylist">{list.map(([n, v]) =>
      <a key={n} className="tb-keyeq" href={"#" + anchor("eq", n)} onClick={e => { e.preventDefault(); document.getElementById(anchor("eq", n))?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
        {v.title && <div className="tb-keyeq-t"><Rich>{v.title}</Rich></div>}
        <EqLine tex={v.tex} n={n} />
      </a>)}
    </div>);
}

// Collapsible details (e.g. lengthy algebra, supplementary material)
export function Details({ summary, children }) {
  const [o, setO] = useState(false);
  return <div className={"tb-details" + (o ? " open" : "")}>
    <div className="tb-details-h" onClick={() => setO(!o)}>{o ? "▾" : "▸"} <TxI>{summary}</TxI></div>
    {o && <div className="tb-details-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>}
  </div>;
}
export const count = c => Children.count(c);

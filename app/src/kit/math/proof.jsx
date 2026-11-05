import { t } from "../i18n/index.js";
// Components for theorem-proof texts (originally from the ETH paper book, since generalized): theorem environments, statement references, step-by-step proofs, proof dependency graphs,
// matrix heatmaps, erratum/note boxes, runnable example shells, study notes tables. See spec/PROOF.md.
//
// Data source: `statements` in the book's book.js (the statement registry, the single source of truth for the whole book, which is what makes cross-page hover previews possible):
//   statements: { "L2.1": { kind, n, ch, en, zh, page, stmt, deps, role, key, pitfall, status, statusNote, eq? }, … }
// Optional: statementKinds (overrides kind names), statementStatus (overrides verification status text).
// Dependency edges are derived from each statement's deps.
import { useMemo, useRef, useState } from "react";
import { TxI, Tx, EqRef, Rich, EqLine, HoverPop, extendInline } from "./tex.jsx";
import { book, pageUrl, currentPage } from "../book.jsx";

// The registry is read at use time (to avoid triggering the circular import with virtual:book during module initialization)
let _cache = null;
function reg() {
  if (_cache && _cache.src === book?.statements) return _cache;
  const STMTS = book?.statements || {};
  const DEP_EDGES = Object.entries(STMTS).flatMap(([id, s]) => (s.deps || []).map(d => ({ from: d, to: id })));
  const KIND_LABEL = { ...t("stmt.kind"), ...(book?.statementKinds || {}) };
  const STATUS_LABEL = { ...t("stmt.status"), ...(book?.statementStatus || {}) };
  return (_cache = { src: book?.statements, STMTS, DEP_EDGES, KIND_LABEL, STATUS_LABEL });
}
// Primary display name of a statement: Chinese books write zh (with en as subtitle); English books write only en.
const nm = s => s.zh || s.en || "";
export const statements = () => reg().STMTS;
export const stmtLabel = id => {
  const { STMTS, KIND_LABEL } = reg(); const s = reg().STMTS[id]; if (!s) return id;
  return s.kind === "fact" || s.kind === "cited" ? `${nm(s)} ${s.n}` : `${reg().KIND_LABEL[s.kind] || s.kind} ${s.n}`;
};

const anchorOf = id => "thm-" + String(id).replace(/[^\w.-]/g, "_");
export { anchorOf };

function go(id, e) {
  const s = reg().STMTS[id]; if (!s) return;
  const here = currentPage();
  const el = document.getElementById(anchorOf(id));
  if (s.ch === here && el) {
    e?.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }
}
const hrefOf = id => pageUrl(reg().STMTS[id]?.ch, anchorOf(id));

// ---------- Statement references: <SRef id="L2.1"/> or <SRef id="L2.1">text</SRef> ----------
// Hover previews the full statement; click jumps to it (across pages too).
export function SRef({ id, children }) {
  const [show, setShow] = useState(false);
  const wrap = useRef(null);
  const s = reg().STMTS[id];
  if (!s) return <span className="tex-error" title={t("stmt.unknown")}>{id}</span>;
  return (
    <span className="ref-wrap sref-wrap" ref={wrap} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <a className={"sref sref-" + s.kind} href={hrefOf(id)} onClick={e => go(id, e)}>{children ?? <Rich>{stmtLabel(id)}</Rich>}</a>
      {show && <HoverPop anchor={wrap.current} className="sref-pop">
        <b><Rich>{stmtLabel(id)}</Rich></b>{s.kind !== "fact" && s.kind !== "cited" && <> · <Rich>{nm(s)}</Rich></>} {s.zh && <i className="muted">{s.en}</i>}
        <span className="sref-stmt"><TxI>{s.stmt}</TxI></span>
        <span className="muted sref-where">{t("stmt.page", s.page)}{t("stmt.clickJump")}</span>
      </HoverPop>}
    </span>);
}

// ---------- \sref{ID}: registered as a framework inline notation ----------
// Once registered, all text in the framework that supports formulas (Tx/TxI, Sec's gist/why, Box, Derivation, Table, Hook, concept cards, Quiz…) understands \sref.
extendInline("sref", (id, k) => <SRef key={k} id={id} />);

// Dependency chip: statement id (with letter prefix) or equation number
const Dep = ({ d }) => (reg().STMTS[d] ? <SRef id={d} /> : <EqRef n={d} />);
const usedBy = id => reg().DEP_EDGES.filter(e => e.from === id).map(e => e.to);

// ---------- Theorem environment: <Stmt id="L2.1">…proof (JSX)…</Stmt> ----------
// Renders: numbered title + statement + study notes (role / depends on / used by / key step / pitfalls / verification status) + children (the proof).
export function Stmt({ id, children, notes = true, toc = true }) {
  const s = reg().STMTS[id];
  const [open, setOpen] = useState(true);
  if (!s) return <div className="tex-error">{t("stmt.unknown")} {id}</div>;
  const numbered = !["fact", "cited"].includes(s.kind);
  const ub = usedBy(id);
  return (
    <div className={"stmt stmt-" + s.kind} id={anchorOf(id)} data-toc={toc && numbered ? `${reg().KIND_LABEL[s.kind]} ${s.n}` : undefined} data-toc-level="2">
      <div className="stmt-h">
        <span className="stmt-kind">{numbered ? `${reg().KIND_LABEL[s.kind]} ${s.n}` : `${reg().KIND_LABEL[s.kind]} ${s.n}`}</span>
        <span className="stmt-zh"><Rich>{nm(s)}</Rich></span>
        {s.zh && <span className="stmt-en">{s.en}</span>}
        <span className="stmt-page">{t("stmt.page", s.page)}</span>
      </div>
      <div className="stmt-body"><TxI>{s.stmt}</TxI></div>
      {notes && <div className={"stmt-notes" + (open ? " open" : "")}>
        <div className="stmt-notes-h" onClick={() => setOpen(!open)}>
          <span>{open ? "▾" : "▸"} {t("stmt.notes")}</span>
          <span className={"stmt-status st-" + s.status}>{reg().STATUS_LABEL[s.status]}</span>
        </div>
        {open && <div className="stmt-grid">
          <div className="sn-lab">{t("stmt.role")}</div><div><TxI>{s.role}</TxI></div>
          <div className="sn-lab">{t("stmt.deps")}</div><div>{s.deps?.length ? s.deps.map(d => <Dep key={d} d={d} />) : <span className="muted">{t("stmt.noDeps")}</span>}</div>
          {ub.length > 0 && <><div className="sn-lab">{t("stmt.usedBy")}</div><div>{ub.map(d => <Dep key={d} d={d} />)}</div></>}
          {s.key && <><div className="sn-lab">{t("stmt.key")}</div><div><TxI>{s.key}</TxI></div></>}
          {s.pitfall && <><div className="sn-lab">{t("stmt.pitfall")}</div><div><TxI>{s.pitfall}</TxI></div></>}
          {s.statusNote && <><div className="sn-lab">{t("stmt.statusNote")}</div><div><TxI>{s.statusNote}</TxI></div></>}
        </div>}
      </div>}
      {children && <div className="stmt-proof">{children}</div>}
    </div>);
}

// ---------- Step-by-step proofs ----------
// steps=[{ claim: "what this step asserts (may contain $…$ and \sref{})", tex?: "optional display equation", why: "reason", uses?: ["L2.1","2.2"], fill?: true (skipped in the original, filled in by this site)}]
export function Proof({ title = t("proof.title"), steps, collapsed = false, qed = true, source }) {
  const [open, setOpen] = useState(!collapsed);
  const [stepwise, setStepwise] = useState(false);
  const [k, setK] = useState(1);
  const shown = stepwise ? steps.slice(0, k) : steps;
  const nfill = steps.filter(s => s.fill).length;
  return (
    <div className={"proof" + (open ? " open" : "")}>
      <div className="proof-h" onClick={() => setOpen(!open)}>
        <span>{open ? "▾" : "▸"} <i>Proof.</i> <TxI>{title}</TxI></span>
        <span className="proof-meta">{t("ui.steps", steps.length)}{nfill ? t("proof.filled", nfill) : ""}{!open && t("ui.clickExpand")}</span>
      </div>
      {open && <>
        <div className="tb-deriv-tools">
          <button className={stepwise ? "" : "on"} onClick={() => setStepwise(false)}>{t("ui.showAll")}</button>
          <button className={stepwise ? "on" : ""} onClick={() => { setStepwise(true); setK(1); }}>{t("proof.stepwise")}</button>
          {source && <span className="muted proof-src"><Rich>{source}</Rich></span>}
        </div>
        <ol className="proof-steps">{shown.map((s, i) =>
          <li key={i} className={"proof-step" + (s.fill ? " fill" : "")}>
            <div className="ps-claim">{s.fill && <span className="ps-fill" title={t("proof.fillTitle")}>{t("proof.fill")}</span>}<TxI>{s.claim}</TxI></div>
            {s.tex && <div className="ps-tex eq-click" data-eqtex={s.tex}><TexLine tex={s.tex} /></div>}
            {(s.why || s.uses?.length > 0) && <div className="ps-why">{s.why && <>∵ <TxI>{s.why}</TxI></>}{s.uses?.length > 0 && <span className="ps-uses">{s.uses.map(u => <Dep key={u} d={u} />)}</span>}</div>}
          </li>)}
        </ol>
        {stepwise && <div className="tb-deriv-ctrl">
          <button disabled={k <= 1} onClick={() => setK(k - 1)}>{t("ui.prevStep")}</button>
          <span>{k} / {steps.length}</span>
          <button disabled={k >= steps.length} onClick={() => setK(k + 1)}>{t("ui.nextStep")}</button>
        </div>}
        {qed && (!stepwise || k === steps.length) && <div className="proof-qed">∎</div>}
      </>}
    </div>);
}
// Display equation inside a proof step (reuses KaTeX; click to zoom)
const TexLine = ({ tex }) => <EqLine tex={tex} />;

// ---------- Erratum / note box ----------
// <Erratum loc="p.8, proof of Lemma 4.1" title="…">{String.raw`explanation and derivation (Tx syntax + \sref{})`}</Erratum>
// kind: "erratum" (likely typo: gives the location and the correct form) | "note" (note: the original is correct, this adds an explanation)
export function Erratum({ loc, title, kind = "note", children }) {
  return (
    <div className={"tb-box erratum er-" + kind}>
      <div className="tb-box-h">{kind === "erratum" ? t("er.erratum") : t("er.note")}{title && <>{t("p.colon")}<TxI>{title}</TxI></>}{loc && <span className="er-loc"><Rich>{loc}</Rich></span>}</div>
      <div className="tb-box-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// ---------- Runnable example shell ----------
export function RunCard({ title, lead, children }) {
  return (
    <div className="runcard card">
      <div className="runcard-h"><span className="run-tag">{t("run.tag")}</span> <b><TxI>{title}</TxI></b></div>
      {lead && <div className="runcard-lead"><TxI>{lead}</TxI></div>}
      {children}
    </div>);
}
// Check badge: <Check ok label="Ryser = definition"/>
export const Check = ({ ok, label, detail }) => (
  <span className={"chk " + (ok ? "ok" : "bad")} title={detail}>{ok ? "✔" : "✘"} <TxI>{label}</TxI></span>);

// ---------- Matrix heatmap ----------
// M: 2D array (rationals {n,d} or numbers); rowGroups/colGroups: group number of each row/column (draws separators, colors);
// cell: size; show: whether to write values in cells; title; highlight(i,j) → whether to highlight.
export function MatrixView({ M: A, rowGroups, colGroups, cell = 22, show = true, title, highlight, rowLabels, colLabels, maxPx = 520 }) {
  const m = A.length, n = A[0]?.length ?? 0;
  const val = x => (typeof x === "number" ? x : Number(x.n) / Number(x.d));
  const str = x => (typeof x === "number" ? String(+x.toPrecision(3)) : x.d === 1n ? String(x.n) : `${x.n}/${x.d}`);
  const maxAbs = Math.max(1e-12, ...A.flat().map(x => Math.abs(val(x))));
  const c = Math.max(6, Math.min(cell, Math.floor(maxPx / Math.max(m, n))));
  const lab = rowLabels || colLabels ? 34 : 0;
  const W = lab + n * c, H = lab + m * c;
  const color = v => { if (v === 0) return "#fffdf8"; const t = 0.25 + 0.75 * Math.min(1, Math.abs(v) / maxAbs); return v > 0 ? `rgba(44,74,110,${t})` : `rgba(155,44,31,${t})`; };
  return (
    <figure className="mview">
      {title && <figcaption><TxI>{title}</TxI></figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: "100%" }}>
        {colLabels && colLabels.map((l, j) => <text key={"c" + j} x={lab + j * c + c / 2} y={lab - 4} className="mv-lab" textAnchor="middle">{l}</text>)}
        {rowLabels && rowLabels.map((l, i) => <text key={"r" + i} x={lab - 4} y={lab + i * c + c / 2 + 4} className="mv-lab" textAnchor="end">{l}</text>)}
        {A.map((row, i) => row.map((x, j) => {
          const v = val(x), hl = highlight?.(i, j);
          return <g key={i + "-" + j}>
            <rect x={lab + j * c} y={lab + i * c} width={c} height={c} fill={color(v)} stroke={hl ? "#b8862b" : "#e8e0d0"} strokeWidth={hl ? 2 : 0.5} />
            {show && v !== 0 && c >= 16 && <text x={lab + j * c + c / 2} y={lab + i * c + c / 2 + 4} textAnchor="middle" className="mv-num" fill={Math.abs(v) / maxAbs > 0.55 ? "#fff" : "#1f1b16"}>{str(x)}</text>}
          </g>;
        }))}
        {rowGroups && rowGroups.map((g, i) => i > 0 && g !== rowGroups[i - 1] && <line key={"rg" + i} x1={lab} x2={W} y1={lab + i * c} y2={lab + i * c} className="mv-sep" />)}
        {colGroups && colGroups.map((g, j) => j > 0 && g !== colGroups[j - 1] && <line key={"cg" + j} y1={lab} y2={H} x1={lab + j * c} x2={lab + j * c} className="mv-sep" />)}
        <rect x={lab} y={lab} width={n * c} height={m * c} fill="none" stroke="#8a7e6a" />
      </svg>
    </figure>);
}

// ---------- Proof dependency graph ----------
// <DepGraph ids?={[…]} highlight?="ch04" focus?="T6.1" />
// Draws all registered statements by default; when ids is given, only those nodes and the edges among them. Layered top-down by longest path (dependencies on top), with the barycenter method reducing crossings within layers.
// Hover: highlights everything upstream (what it depends on) and downstream (what depends on it); click: the right panel shows the statement and study notes, with a jump link.
const KCOL = { definition: "#3c6b4a", lemma: "#2c4a6e", proposition: "#5b3f7a", theorem: "#9b2c1f", fact: "#8a7e6a", cited: "#a0a0a0", corollary: "#b8862b" };
export function DepGraph({ ids, highlight, focus, nodeW = 150, nodeH = 50, gapX = 14, gapY = 40 }) {
  const g = useMemo(() => {
    const set = new Set(ids || Object.keys(reg().STMTS));
    const edges = reg().DEP_EDGES.filter(e => set.has(e.from) && set.has(e.to));
    const nodes = [...set];
    const preds = Object.fromEntries(nodes.map(i => [i, edges.filter(e => e.to === i).map(e => e.from)]));
    const lvl = {};
    const L = i => (lvl[i] ??= preds[i].length ? 1 + Math.max(...preds[i].map(L)) : 0);
    nodes.forEach(L);
    // Move source nodes used by only one downstream node to the layer just above it (shortens long edges)
    for (const i of nodes) if (!preds[i].length) { const outs = edges.filter(e => e.from === i).map(e => lvl[e.to]); if (outs.length) lvl[i] = Math.max(0, Math.min(...outs) - 1); }
    const rows = {}; nodes.forEach(i => (rows[lvl[i]] ??= []).push(i));
    const keys = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const ord = {}; keys.forEach(k => rows[k].sort((a, b) => (reg().STMTS[a].ch + a).localeCompare(reg().STMTS[b].ch + b, undefined, { numeric: true })).forEach((id, j) => (ord[id] = j)));
    for (let sweep = 0; sweep < 6; sweep++) {      // barycenter method
      const ks = sweep % 2 ? [...keys].reverse() : keys;
      for (const k of ks) {
        const bc = id => { const nb = edges.filter(e => e.to === id).map(e => e.from).concat(edges.filter(e => e.from === id).map(e => e.to)); return nb.length ? nb.reduce((s, x) => s + ord[x] / Math.max(1, rows[lvl[x]].length), 0) / nb.length : ord[id] / rows[k].length; };
        rows[k].sort((a, b) => bc(a) - bc(b)).forEach((id, j) => (ord[id] = j));
      }
    }
    const maxW = Math.max(...keys.map(k => rows[k].length));
    const W = maxW * (nodeW + gapX) + gapX, pos = {};
    keys.forEach((k, r) => { const row = rows[k], off = (W - row.length * (nodeW + gapX) + gapX) / 2; row.forEach((id, j) => (pos[id] = { x: off + j * (nodeW + gapX), y: 16 + r * (nodeH + gapY) })); });
    return { nodes, edges, pos, W, H: 16 + keys.length * (nodeH + gapY) - gapY + 16 };
  }, [ids, nodeW, nodeH, gapX, gapY]);
  const [hover, setHover] = useState(null), [sel, setSel] = useState(focus || null);
  const rel = useMemo(() => {
    const c = hover || sel; if (!c) return null;
    const s = new Set([c]);
    const up = id => g.edges.filter(e => e.to === id).forEach(e => { if (!s.has(e.from)) { s.add(e.from); up(e.from); } });
    const down = id => g.edges.filter(e => e.from === id).forEach(e => { if (!s.has(e.to)) { s.add(e.to); down(e.to); } });
    up(c); down(c); return s;
  }, [hover, sel, g]);
  const S = sel && reg().STMTS[sel];
  return (
    <div className="depgraph card">
      <div className="dg-legend">{Object.entries(KCOL).map(([k, c]) => <span key={k}><i style={{ background: c }} />{reg().KIND_LABEL[k]}</span>)}
        {highlight && <span><i className="dg-hl" />{t("dg.here")}</span>}</div>
      <div className="dg-wrap">
        <div className="dg-scroll">
          <svg viewBox={`0 0 ${g.W} ${g.H}`} width={g.W} height={g.H} className="dg-svg" style={{ maxWidth: "100%", height: "auto", minWidth: Math.min(g.W, 760) }}>
            <defs><marker id="dgarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9c8f78" /></marker></defs>
            {g.edges.map((e, i) => {
              const a = g.pos[e.from], b = g.pos[e.to];
              const x1 = a.x + nodeW / 2, y1 = a.y + nodeH, x2 = b.x + nodeW / 2, y2 = b.y - 3, my = (y1 + y2) / 2;
              const dim = rel && !(rel.has(e.from) && rel.has(e.to));
              return <path key={i} className={"dg-edge" + (dim ? " dim" : rel ? " on" : "")} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} markerEnd="url(#dgarr)" />;
            })}
            {g.nodes.map(id => {
              const p = g.pos[id], s = reg().STMTS[id], dim = rel && !rel.has(id), hl = highlight && s.ch === highlight;
              return <foreignObject key={id} x={p.x} y={p.y} width={nodeW} height={nodeH} className={dim ? "dim" : ""}>
                <div className={"dg-node" + (sel === id ? " sel" : "") + (hl ? " hl" : "")} style={{ "--k": KCOL[s.kind] }}
                  onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)} onClick={() => setSel(sel === id ? null : id)}>
                  <div className="dg-k">{stmtLabel(id).replace(nm(s) + " ", "")}<span className="dg-ch">{s.ch === "appA" ? t("dg.appA") : s.ch === "appB" ? t("dg.appB") : "§" + s.ch.slice(2).replace(/^0/, "")}</span></div>
                  <div className="dg-t"><Rich>{nm(s)}</Rich></div>
                </div>
              </foreignObject>;
            })}
          </svg>
        </div>
        <div className="dg-panel">{S ? <>
          <div className="dg-p-h"><b><Rich>{stmtLabel(sel)}</Rich></b> {S.kind !== "fact" && S.kind !== "cited" && <Rich>{nm(S)}</Rich>}</div>
          <div className="dg-p-s"><TxI>{S.stmt}</TxI></div>
          {S.role && <div className="dg-p-r"><span className="sn-lab">{t("stmt.role")}</span> <TxI>{S.role}</TxI></div>}
          <div className="dg-p-r"><span className="sn-lab">{t("stmt.deps")}</span> {S.deps?.length ? S.deps.map(d => <Dep key={d} d={d} />) : "—"}</div>
          <div className="dg-p-r"><span className={"stmt-status st-" + S.status}>{reg().STATUS_LABEL[S.status]}</span></div>
          <a className="dg-go" href={hrefOf(sel)} onClick={e => go(sel, e)}>{t("dg.go")}</a>
        </> : <div className="muted">{t("dg.hint")}</div>}</div>
      </div>
    </div>);
}

// ---------- Study notes table for this page ----------
export function StudyTable({ ids }) {
  return (
    <div className="tb-table-wrap"><table className="tb-table study">
      <thead><tr><th>{t("study.stmt")}</th><th>{t("study.role")}</th><th>{t("study.deps")}</th><th>{t("study.status")}</th></tr></thead>
      <tbody>{ids.map(id => { const s = reg().STMTS[id]; return <tr key={id}>
        <td><SRef id={id} /><div className="muted"><Rich>{nm(s)}</Rich></div></td>
        <td><TxI>{s.role}</TxI></td>
        <td>{s.deps?.map(d => <Dep key={d} d={d} />)}</td>
        <td className={"st-" + s.status}>{reg().STATUS_LABEL[s.status]}</td></tr>; })}</tbody>
    </table></div>);
}

// Small utility: labeled slider
export function Slider({ label, value, min, max, step = 1, onChange, fmt = v => v }) {
  return <label className="pslider"><span className="pslider-l"><TxI>{label}</TxI> = <b>{fmt(value)}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} /></label>;
}
// Small utility: segmented buttons
export function Seg({ options, value, onChange }) {
  return <div className="seg">{options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <button key={v} className={v === value ? "on" : ""} onClick={() => onChange(v)}><TxI>{String(l)}</TxI></button>; })}</div>;
}

// A page's statements + their direct dependencies and direct users (for this page's <DepGraph ids={pageIds("ch04")} highlight="ch04" />)
export function pageIds(ch) {
  const own = Object.keys(reg().STMTS).filter(k => reg().STMTS[k].ch === ch);
  const s = new Set(own);
  for (const k of own) { (reg().STMTS[k].deps || []).forEach(d => s.add(d)); reg().DEP_EDGES.filter(e => e.from === k).forEach(e => s.add(e.to)); }
  return [...s];
}

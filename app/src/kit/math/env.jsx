import { assetUrl } from "../book.jsx";
import { useState, useEffect, Children } from "react";
import { renderTex, EqLine, FitTex, Tx, TxI, Rich, plainText, anchor, useTextbook } from "./tex.jsx";

// ---------- 章节标题 ----------
// <Sec n="2.1" title="Expanding space" zh="膨胀的空间" gist="一句话：本节做成了什么" why="为什么需要这一步" gives={["2.12","2.28"]}>
// gist/why/gives 会在节首渲染成「本节要点」卡（gives 为本节产出的关键方程编号，可点击放大）。
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
      {gist && <div className="tb-sc-gist"><span className="tb-sc-lab">本节要点</span><TxI>{gist}</TxI></div>}
      {why && <div className="tb-sc-why"><span className="tb-sc-lab">为什么</span><TxI>{why}</TxI></div>}
      {gives?.length > 0 && <div className="tb-sc-gives"><span className="tb-sc-lab">产出</span>{gives.map(n => <EqChip key={n} n={n} tb={tb} />)}</div>}
    </div>);
}
// 小号公式卡（读取登记表；点击放大）
export function EqChip({ n, tb: tb0, label }) {
  const tb = useTextbook() || tb0;
  const info = tb?.eqs.current.get(String(n));
  return (
    <span className="eq-chip" onClick={() => info && tb.openEq({ tex: info.tex, n, title: info.title, say: info.say })} title="点击放大">
      {label && <b>{label}</b>}
      {info && <FitTex tex={info.tex} min={0.45} className="eq-chip-m" />}<span className="eq-chip-n">({n})</span>
    </span>);
}
export function Sub({ n, title, zh, children }) {
  return (
    <section className="tb-sub" id={anchor("sec", n)}>
      <h3 className="tb-h3"><span className="tb-num">{n}</span> <Rich>{zh || title}</Rich>{zh && title && <small className="tb-en">{title}</small>}</h3>
      {children}
    </section>);
}

// ---------- 环境框 ----------
const KINDS = {
  definition: ["定义", "📐"], result: ["结论", "✅"], note: ["注", "📝"], example: ["例", "🔎"],
  physics: ["物理图像", "💡"], warning: ["易错点", "⚠️"], aside: ["拓展", "📎"], key: ["要点", "🔑"], data: ["观测", "🔭"],
};
// <Box kind="physics" title="为什么光子能量随 1/a 衰减">{String.raw`...含 $公式$ 的正文...`}</Box>（children 也可为 JSX）
export function Box({ kind = "note", title, children }) {
  const [label, icon] = KINDS[kind] || KINDS.note;
  return (
    <div className={"tb-box tb-" + kind}>
      <div className="tb-box-h">{icon} {label}{title && <>：<TxI>{title}</TxI></>}</div>
      <div className="tb-box-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// ---------- 推导 ----------
// 每一步：一行公式 + 理由。steps=[{tex, why}]；why 支持 $...$ 与引用。
// mode：默认全部展开；stepwise 时逐步揭示。collapsed 时默认折叠（长推导）。
export function Derivation({ title = "推导", steps, collapsed = false, result }) {
  const [open, setOpen] = useState(!collapsed);
  const [stepwise, setStepwise] = useState(false);
  const [k, setK] = useState(1);
  const shown = stepwise ? steps.slice(0, k) : steps;
  return (
    <div className={"tb-deriv" + (open ? " open" : "")}>
      <div className="tb-deriv-h" onClick={() => setOpen(!open)}>
        <span>{open ? "▾" : "▸"} 🧮 <TxI>{title}</TxI></span>
        <span className="tb-deriv-meta">{steps.length} 步{!open && " · 点击展开"}</span>
      </div>
      {open && <>
        <div className="tb-deriv-tools">
          <button className={stepwise ? "" : "on"} onClick={() => setStepwise(false)}>全部显示</button>
          <button className={stepwise ? "on" : ""} onClick={() => { setStepwise(true); setK(1); }}>逐步推导</button>
        </div>
        <ol className="tb-steps">{shown.map((s, i) =>
          <li key={i} className="tb-step">
            <div className="tb-step-m eq-click" data-eqtex={s.tex}><EqLine tex={s.tex} /></div>
            {s.why && <div className="tb-step-why"><TxI>{s.why}</TxI></div>}
          </li>)}
        </ol>
        {stepwise && <div className="tb-deriv-ctrl">
          <button disabled={k <= 1} onClick={() => setK(k - 1)}>← 上一步</button>
          <span>{k} / {steps.length}</span>
          <button disabled={k >= steps.length} onClick={() => setK(k + 1)}>下一步 →</button>
        </div>}
        {result && (!stepwise || k === steps.length) && <div className="tb-deriv-res">∴ <TxI>{result}</TxI></div>}
      </>}
    </div>);
}

// ---------- 图 ----------
// 原书插图（figures/fig-<n>.png）+ 中文图注；可选 interactive（交互版，JSX），以标签切换。
export function Figure({ n, caption, children, interactive, width = "100%", src }) {
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
        <button className={tab === 0 ? "on" : ""} onClick={() => setTab(0)}>原书图</button>
        <button className={tab === 1 ? "on" : ""} onClick={() => setTab(1)}>交互版</button>
      </div>}
      {tab === 0 || !interactive
        ? <img src={img} alt={`图 ${n}`} style={{ maxWidth: width }} onClick={() => setZoom(true)} title="点击放大" loading="lazy" />
        : <div className="tb-fig-int">{interactive}</div>}
      <figcaption><b>图 {n}</b> <TxI>{caption}</TxI>{children}</figcaption>
      {zoom && <div className="tb-zoom" onClick={() => setZoom(false)}><img src={img} alt="" /></div>}
    </figure>);
}

// ---------- 习题 ----------
// <Exercise n="2.3" title="…" level="★★">{String.raw`题目`}</Exercise>，hint / solution 为字符串或 JSX；
// fromBook：解答依据原书附录 A（标注出处）。
export function Exercise({ n, title, level, children, hint, solution, fromBook }) {
  const [h, setH] = useState(false), [s, setS] = useState(false);
  const body = x => (typeof x === "string" ? <Tx>{x}</Tx> : x);
  return (
    <div className="tb-ex" id={anchor("ex", n)}>
      <div className="tb-ex-h"><b>习题 {n}</b>{title && <> · <TxI>{title}</TxI></>}{level && <span className="tb-ex-lv">{level}</span>}</div>
      <div className="tb-ex-b">{body(children)}</div>
      <div className="tb-ex-tools">
        {hint && <button onClick={() => setH(!h)}>{h ? "收起提示" : "💡 提示"}</button>}
        {solution && <button onClick={() => setS(!s)}>{s ? "收起解答" : "📖 解答"}</button>}
      </div>
      {h && <div className="tb-ex-hint">{body(hint)}</div>}
      {s && <div className="tb-ex-sol">{fromBook && <div className="tb-ex-src">依据原书附录 A 的解答整理</div>}{body(solution)}</div>}
    </div>);
}

// ---------- 符号表 ----------
// rows: [{sym: "\\eta", name: "共形时间", def: "…（可含 $…$）", eq: "2.36"}]
export function Notation({ rows }) {
  const [q, setQ] = useState("");
  const list = rows.filter(r => !q || (r.sym + r.name + (r.def || "")).toLowerCase().includes(q.toLowerCase()));
  return <>
    {rows.length > 8 && <input className="search" placeholder="搜索符号…" value={q} onChange={e => setQ(e.target.value)} />}
    <table className="tb-table tb-notation"><thead><tr><th>符号</th><th>名称</th><th>定义 / 说明</th><th>首见</th></tr></thead>
      <tbody>{list.map((r, i) => <tr key={i}>
        <td dangerouslySetInnerHTML={{ __html: renderTex(r.sym) }} />
        <td><Rich>{r.name}</Rich></td><td><TxI>{r.def}</TxI></td><td>{r.eq ? <TxI>{`\\eqref{${r.eq}}`}</TxI> : ""}</td></tr>)}
      </tbody></table>
  </>;
}

// 通用表格（单元格支持 $…$）。head: [..]，rows: [[..],..]
export const Table = ({ head, rows, caption }) => (
  <div className="tb-table-wrap">
    <table className="tb-table">
      {head && <thead><tr>{head.map((h, i) => <th key={i}><TxI>{h}</TxI></th>)}</tr></thead>}
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><TxI>{c}</TxI></td>)}</tr>)}</tbody>
    </table>
    {caption && <div className="tb-table-cap"><TxI>{caption}</TxI></div>}
  </div>);

// 本章关键方程汇总（自动收集带 k 的 Eq）
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

// 可折叠的细节（如冗长代数、补充材料）
export function Details({ summary, children }) {
  const [o, setO] = useState(false);
  return <div className={"tb-details" + (o ? " open" : "")}>
    <div className="tb-details-h" onClick={() => setO(!o)}>{o ? "▾" : "▸"} <TxI>{summary}</TxI></div>
    {o && <div className="tb-details-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>}
  </div>;
}
export const count = c => Children.count(c);

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Eq, Tx, TxI } from "../math/tex.jsx";

// 按重要性分配页面面积（见 framework/spec/PAPER.md「重要性加权」）。
// 思路：带公式的论文里，信息的重要性与所占面积常常倒挂——一条关键式子和三行例行代数一样大，决定结论的假设藏在小字里。
// 这里给每块内容一个权重 w ∈ {3, 2, 1}：
//   3 = 必须看到（核心结论、关键公式、决定性数字、关键假设）：放大、加粗、带色条，并登记到「要点脊柱」与「重要性地图」
//   2 = 正文（默认）
//   1 = 细节（例行推导、旁支）：缩小、变灰；「扫读」模式下折叠
// 页面级：<Weighted> 提供扫读/精读开关、右侧要点脊柱与重要性地图（PaperPage 传 weighted 即自动包裹）。

const WCtx = createContext(null);
const useW = () => useContext(WCtx);

export function Weighted({ children }) {
  const [items, setItems] = useState([]);       // 已登记的权重 3 条目 {id, label, kind}
  const [skim, setSkim] = useState(() => { try { return localStorage.getItem("pw-skim") === "1"; } catch { return false; } });
  useEffect(() => { document.body.classList.toggle("pw-skim", skim); try { localStorage.setItem("pw-skim", skim ? "1" : "0"); } catch { /* 无痕模式 */ } }, [skim]);
  const api = useRef({
    add: it => setItems(xs => (xs.some(x => x.id === it.id) ? xs : [...xs, it])),
    remove: id => setItems(xs => xs.filter(x => x.id !== id)),
  }).current;
  return (
    <WCtx.Provider value={{ ...api, items, skim, setSkim }}>
      {children}
      <SkimToggle />
      <Spine />
    </WCtx.Provider>);
}

// 权重 3 条目登记：返回锚点 id
function useKey(label, kind, given) {
  const w = useW(); const auto = "k-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = given || auto;
  useEffect(() => { if (!w) return; w.add({ id, label, kind }); return () => w.remove(id); }, [id, label, kind]);
  return id;
}

const KIND_ICON = { claim: "◆", eq: "∑", num: "#", assume: "⚠", verdict: "✔" };

// 段落：w=3 核心论断 / w=2 正文 / w=1 细节
export function P({ w = 2, label, id, children }) {
  const body = typeof children === "string" ? <Tx>{children}</Tx> : children;
  if (w === 3) return <KeyPara label={label} id={id}>{body}</KeyPara>;
  return <div className={"pw pw-" + w}>{body}</div>;
}
function KeyPara({ label, id, children }) {
  const kid = useKey(label || "核心论断", "claim", id);
  return <div className="pw pw-3" id={kid}>{children}</div>;
}

// 关键公式：先用大字说「这条式子在说什么」，再放大显示公式（仍可点开逐符号解读）。
// parts: [{ tex, note }] —— 公式里最该盯住的几个部分（可选）
export function BigEq({ n, meaning, label, say, parts, children }) {
  const kid = useKey(label || (n ? `式 (${n})` : "关键公式"), "eq");
  return (
    <div className="pw-bigeq" id={kid}>
      {meaning && <div className="pw-mean"><TxI>{meaning}</TxI></div>}
      <div className="pw-bigeq-eq"><Eq n={n} keyEq title={label} say={say || meaning}>{children}</Eq></div>
      {parts?.length > 0 && <div className="pw-parts">{parts.map((p, i) => <span key={i} className="pw-part"><TxI>{`$${p.tex}$`}</TxI><small><TxI>{p.note}</TxI></small></span>)}</div>}
    </div>);
}

// 次要公式：缩小显示，扫读时折叠
export const MinorEq = props => <div className="pw pw-1 pw-mineq"><Eq {...props} /></div>;

// 例行推导：一行折叠条，展开看细节。扫读时整体收起。
export function Fold({ title = "推导", steps, note = "可跳过", children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"pw-fold" + (open ? " open" : "")}>
      <button onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} <TxI>{title}</TxI>{steps ? ` · ${steps} 步` : ""}<em>{note}</em></button>
      {open && <div className="pw-fold-b">{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>}
    </div>);
}

// 决定性数字
export function Number({ value, label, why, id }) {
  const kid = useKey(`${typeof value === "string" ? value.replace(/\$/g, "") : value} ${label}`, "num", id);
  return (
    <div className="pw-num" id={kid}>
      <b><TxI>{String(value)}</TxI></b>
      <div><span><TxI>{label}</TxI></span>{why && <small><TxI>{why}</TxI></small>}</div>
    </div>);
}

// 关键假设 / 前提：论文里常藏在小字里，这里放大
export function Assume({ title, children, id }) {
  const kid = useKey(title || "关键假设", "assume", id);
  return (
    <div className="pw-assume" id={kid}>
      <div className="pw-assume-h">⚠ 关键假设{title ? <>：<TxI>{title}</TxI></> : null}</div>
      <div>{typeof children === "string" ? <Tx>{children}</Tx> : children}</div>
    </div>);
}

// 结论句：「所以……」
export function Verdict({ children, label, id }) {
  const kid = useKey(label || "结论", "verdict", id);
  return <div className="pw-verdict" id={kid}><span>所以</span>{typeof children === "string" ? <TxI>{children}</TxI> : children}</div>;
}

// 首屏：最重要的公式 / 数字 / 假设并排放在页首
export const AboveFold = ({ title = "这篇论文最重要的东西", children }) => (
  <section className="pw-above" data-toc="首屏要点"><div className="pw-above-h">{title}</div><div className="pw-above-g">{children}</div></section>);

// 扫读 / 精读开关
function SkimToggle() {
  const w = useW();
  return (
    <div className="pw-toggle" role="group" aria-label="阅读模式">
      <button className={w.skim ? "on" : ""} onClick={() => w.setSkim(true)} title="只看权重高的内容，细节折叠">扫读</button>
      <button className={!w.skim ? "on" : ""} onClick={() => w.setSkim(false)} title="显示全部内容">精读</button>
    </div>);
}

// 要点脊柱 + 重要性地图：右侧列出全部权重 3 条目（当前位置高亮），并在竖条上按其在页面中的位置打点
function Spine() {
  const w = useW(); const [pos, setPos] = useState({}); const [cur, setCur] = useState(null); const [open, setOpen] = useState(true);
  useLayoutEffect(() => {
    const measure = () => {
      const H = document.documentElement.scrollHeight, out = {};
      for (const it of w.items) { const el = document.getElementById(it.id); if (el) out[it.id] = (el.getBoundingClientRect().top + scrollY) / H; }
      setPos(out);
      const mid = scrollY + innerHeight * 0.35; let c = null;
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
  return (<>
    <div className="pw-map" aria-label="重要性地图">
      {sorted.map(it => <button key={it.id} className={"pw-dot k-" + it.kind + (cur === it.id ? " on" : "")} style={{ top: `${pos[it.id] * 100}%` }} onClick={() => go(it.id)} title={it.label} />)}
    </div>
    <aside className={"pw-spine" + (open ? "" : " closed")}>
      <button className="pw-spine-h" onClick={() => setOpen(!open)}>{open ? "要点脊柱 ▾" : "要点 ▸"}<small>{sorted.length}</small></button>
      {open && <ol>{sorted.map(it => (
        <li key={it.id} className={cur === it.id ? "on" : ""}><a href={"#" + it.id} onClick={e => { e.preventDefault(); go(it.id); }}>
          <i className={"k-" + it.kind}>{KIND_ICON[it.kind] || "◆"}</i><TxI>{it.label}</TxI></a></li>))}</ol>}
    </aside>
  </>);
}

import { t } from "./i18n/index.js";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Rich, RichParas, plainText } from "./math/tex.jsx";
import { pageUrl, nameOf } from "./book.jsx";

// ---------- 小工具 ----------
// 分段文本；含 $…$ / \eqref 等记号时自动按公式渲染（见 math/tex.jsx 的 RichParas），否则与原来完全相同
export const Paras = props => RichParas(props);
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
export const PALETTE = ["#9b2c1f", "#b8862b", "#2c4a6e", "#3c6b4a", "#5b3f7a", "#8a5a2b", "#2f6f73", "#c0567a", "#6b7d2a", "#4a5fa8", "#a0522d", "#3d3d3d"];

// 进入视口一次后返回 true
export function useReveal(threshold = .5) {
  const ref = useRef(null), [vis, setVis] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVis(true), { threshold });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, vis];
}

export function useToast(ms = 3200) {
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), ms); return () => clearTimeout(t); }, [msg, ms]);
  return [msg && <div className="toast">{msg}</div>, setMsg];
}

// ---------- 章节上下文：概念表、分组配色、概念弹窗 ----------
const Ctx = createContext({ byId: {}, concepts: [], relations: [], groups: [], color: () => PALETTE[0], open: () => { } });
export const useChapter = () => useContext(Ctx);

// extra：额外可查找（可弹窗）但不参与网格/地图的概念，如跨章概念 "ch03:mathesis"
export function ChapterProvider({ meta, groups = [], concepts = [], relations = [], extra = [], children }) {
  const [openId, setOpenId] = useState(null);
  const value = useMemo(() => {
    const byId = Object.fromEntries([...extra, ...concepts].map(c => [c.id, c]));
    const gi = Object.fromEntries(groups.map((g, i) => [g.id, i]));
    return {
      meta, groups, concepts, relations, byId,
      color: g => PALETTE[(gi[g] ?? groups.length) % PALETTE.length],
      groupLabel: g => groups.find(x => x.id === g)?.label || g,
      open: id => byId[id] && setOpenId(id),
    };
  }, [meta, groups, concepts, relations, extra]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {openId && <ConceptModal c={value.byId[openId]} onClose={() => setOpenId(null)} />}
    </Ctx.Provider>);
}

// 概念胶囊（点击打开概念弹窗）
export function ConceptChip({ id, prefix }) {
  const { byId, open } = useChapter();
  const c = byId[id];
  if (!c) return null;
  return <span className="chip" onClick={() => open(id)}>{prefix != null ? <Rich>{prefix}</Rich> : c.icon} <Rich>{nameOf(c)}</Rich>{c.chapter && <small className="chip-ch"> · {c.chapter.label.split(" · ")[0]}</small>}</span>;
}

// 正文中的行内概念链接：<C id="mathesis">数理</C>
export function C({ id, children }) {
  const { byId, open, color } = useChapter();
  const c = byId[id];
  return <span className="cref" style={{ "--g": c ? color(c.group) : undefined }} onClick={() => open(id)} title={plainText(c?.plain)}>{children ?? <Rich>{(c && nameOf(c)) || id}</Rich>}</span>;
}

function ConceptModal({ c, onClose }) {
  const { relations, color } = useChapter();
  const [tab, setTab] = useState(0);
  useEffect(() => setTab(0), [c.id]);
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  const tabs = [
    c.explain && [t("cc.explain"), <Paras text={c.explain} />],
    c.analogy && [t("cc.analogy"), <Paras text={c.analogy} />],
    c.book_example && [t("cc.example"), <><p><b>{t("cc.exWhat")}</b><Rich>{c.book_example.what}</Rich></p><p><b>{t("cc.exPoint")}</b><Rich>{c.book_example.point}</Rich></p></>],
  ].filter(Boolean);
  const rel = relations.filter(r => r.from === c.id || r.to === c.id);
  return (
    <div id="modal" onClick={e => e.target.id === "modal" && onClose()}>
      <div className="modal-card" role="dialog" style={{ "--g": color(c.group) }}>
        <button className="close" aria-label={t("ui.close")} onClick={onClose}>×</button>
        <div className="mhead"><div className="ic">{c.icon}</div>
          <div><h3><Rich>{nameOf(c)}</Rich></h3>{c.name_zh && <div className="muted-it"><Rich>{c.name_en}</Rich></div>}</div></div>
        {c.chapter && <a className="xch" href={pageUrl(c.chapter.id)}>📖 {c.chapter.label} →</a>}
        <div className="mplain"><Rich>{c.plain}</Rich></div>
        <div className="tabs">{tabs.map((t, i) => <button key={i} className={i === tab ? "on" : ""} onClick={() => setTab(i)}>{t[0]}</button>)}</div>
        <div className="tabpane">{tabs[tab]?.[1]}</div>
        {c.misconception && <div className="warn"><b>{t("cc.misconception")}</b><Rich>{c.misconception}</Rich></div>}
        {rel.length > 0 && <div className="related">{t("cc.related")}{rel.map((r, i) => {
          const out = r.from === c.id;
          return <ConceptChip key={i} id={out ? r.to : r.from} prefix={`${out ? "→" : "←"} ${r.label} ·`} />;
        })}</div>}
      </div>
    </div>);
}

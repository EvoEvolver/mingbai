import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import "katex/dist/katex.min.css";
import { book, modules, pageUrl, assetUrl } from "../book.jsx";
import { buildTable, annotate, symKey } from "./sym.js";

// ---------- KaTeX 渲染 ----------
// 书级宏在 book.js 的 katexMacros 中定义（如 "\\H": "\\mathcal{H}"）。宏在首次渲染时读取
// （避免与 virtual:book 的循环导入在模块初始化时触发）。
let MACROS = null, MACRO_RE = null;
function macros() {
  if (!MACROS) {
    // \sym{id}{…}/\nosym{…} 在有符号表的章节页由 annotate 处理；其他场合（书架、跨章预览等）按普通内容渲染
    MACROS = { ...(book?.katexMacros || {}) };
    // 预展开只针对书级宏（\\sym/\\nosym 必须原样留给 annotate 识别）
    const names = Object.keys(book?.katexMacros || {}).map(k => k.replace(/^\\/, "")).sort((a, b) => b.length - a.length);
    MACRO_RE = names.length ? new RegExp(`\\\\(${names.join("|")})(?![a-zA-Z])`, "g") : null;
  }
  return MACROS;
}
// 展开书级宏（符号识别需要看到展开后的源码，如 \Om → \Omega_{\mathrm{m}}）
export function expandMacros(tex) {
  const M = macros(); if (!MACRO_RE) return tex;
  let s = tex;
  for (let k = 0; k < 3; k++) { const n = s.replace(MACRO_RE, (_, name) => M["\\" + name]); if (n === s) break; s = n; }
  return s;
}

// 当前章节的符号表（TextbookProvider 在渲染时设置；只同时显示一章）
let ACTIVE = { table: null, ver: 0 };
const cache = new Map(), usedCache = new Map();
const trust = c => ["\\htmlData"].includes(c.command);

export function renderTex(tex, display = false) {
  const key = ACTIVE.ver + (display ? "D" : "I") + tex;
  if (cache.has(key)) return cache.get(key);
  macros();
  let src = tex;
  if (ACTIVE.table) { const r = annotate(expandMacros(tex), ACTIVE.table); src = r.tex; usedCache.set(ACTIVE.ver + tex, r.used); }
  // 未被 annotate 处理的 \sym{id}{…} / \nosym{…}（无符号表的页面，或嵌在不识别的位置）：剥掉标记，只保留内容
  src = src.replace(/\\sym\{[^{}]*\}/g, "").replace(/\\nosym(?![a-zA-Z])/g, "");
  let html;
  try {
    html = katex.renderToString(src, { displayMode: display, throwOnError: true, macros: { ...MACROS }, strict: "ignore", trust, output: "html" });
  } catch (e) {
    // 渲染失败：显示原文并标红，自检脚本会统计 .tex-error
    html = `<span class="tex-error" title="${String(e.message).replace(/"/g, "&quot;")}">${tex.replace(/</g, "&lt;")}</span>`;
  }
  cache.set(key, html);
  return html;
}
// 某段公式里用到的符号 id
export function symbolsIn(tex) {
  if (!ACTIVE.table) return [];
  const k = ACTIVE.ver + tex;
  if (!usedCache.has(k)) usedCache.set(k, annotate(expandMacros(tex), ACTIVE.table).used);
  return [...usedCache.get(k)];
}

// 行内公式：<M>{String.raw`\dot a/a`}</M>
export const M = ({ children }) => <span className="m" dangerouslySetInnerHTML={{ __html: renderTex(String(children)) }} />;

// ---------- 自适应缩放 ----------
// 让 ref 元素内的 KaTeX 内容缩放到能放进元素本身：KaTeX 以 em 为单位，调 font-size 即等比缩放。
// both=true 时同时适配高度（用于固定大小的节点）。缩到 min 仍放不下时保留滚动。
export function useFit(ref, deps = [], { min = 0.7, both = false } = {}) {
  useLayoutEffect(() => {
    const box = ref.current; if (!box) return;
    // 以 .katex-html 各片段的实际外接框计算尺寸（居中内容会向两侧溢出，scrollWidth 只计右侧，不可靠）
    const measure = () => {
      const h = box.querySelector(".katex-html"); if (!h) return null;
      let l = Infinity, r = -Infinity;
      for (const c of h.children) { const b = c.getBoundingClientRect(); if (b.width) { l = Math.min(l, b.left); r = Math.max(r, b.right); } }
      return r > l ? { w: r - l, h: h.getBoundingClientRect().height } : null;
    };
    const fit = () => {
      box.style.fontSize = "";
      const base = parseFloat(getComputedStyle(box).fontSize);       // 原始像素字号
      // 可用尺寸也用 getBoundingClientRect：与内容测量处于同一坐标系，动画中的 transform 缩放不会造成比例失真
      const bb = box.getBoundingClientRect(), sx = box.clientWidth ? bb.width / box.clientWidth : 1;
      const aw = bb.width - 4 * sx, ah = bb.height - 4 * sx;
      let sc = 1;
      for (let it = 0; it < 3; it++) {                                  // 迭代校准（行高/间距并非严格线性）
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
    document.fonts?.ready.then(() => live && fit());     // KaTeX 字体加载后尺寸会变
    const ro = new ResizeObserver(() => fit()); ro.observe(box);
    return () => { live = false; ro.disconnect(); };
  }, deps);   // eslint-disable-line
}

// 行间公式排版：公式区 + 编号栏（不用 KaTeX \tag：长公式会与绝对定位的编号重叠）。
// 公式过宽时自动缩小（最低 min），仍放不下则在公式区内横向滚动；编号永远独占右侧一栏。
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

// 行内公式自适应（用于固定宽度的小卡片/节点）
export function FitTex({ tex, display = false, min = 0.4, both = false, className = "" }) {
  const ref = useRef(null);
  const html = renderTex(tex, display);
  useFit(ref, [html], { min, both });
  return <div className={"fittex " + className} ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- 教科书上下文：公式登记表 + 符号词典 ----------
const TbCtx = createContext(null);
export const useTextbook = () => useContext(TbCtx);

let tableVer = 0;
// notation：本章符号表 [{sym, name, def, eq, unit, id?}]；其他章节导出的 notation 也会并入（本章优先）
export function TextbookProvider({ chapterId, notation = [], children }) {
  const eqs = useRef(new Map());              // n -> {tex, key, title, say}
  const [ver, setVer] = useState(0);
  const [pop, setPop] = useState(null);       // 符号弹卡 {id, x, y}
  const [modal, setModal] = useState(null);   // 公式放大 {tex, n, title, say}

  // 符号表：本章在前，其余章节在后（全书统一编号 id）
  const sym = useMemo(() => {
    const slug = (ch, s) => (ch + "-" + s).replace(/[^A-Za-z0-9]+/g, "_");
    const all = [];
    // 自动 id 由符号生成；不同符号可能生成相同 slug（如 D_+ 与 D_-），重名时追加序号保证唯一
    const taken = new Set();
    const uniq = id => { let u = id, k = 2; while (taken.has(u)) u = id + "_" + k++; taken.add(u); return u; };
    const push = (ch, list) => (list || []).forEach(e => all.push({ ...e, chapter: ch, id: uniq(e.id ? ch + "-" + e.id : slug(ch, e.sym)) }));
    push(chapterId, notation);
    for (const c of book.chapters) if (c.id !== chapterId) push(c.id, modules[c.id]?.notation);
    const byId = Object.fromEntries(all.map(e => [e.id, e]));
    // 常见的多义单字母（e 自然常数/电子、d 微分/距离、π）只采用本章词典的条目，避免借用他章含义造成误标
    const LOCAL_ONLY = new Set(["e|", "d|", "\\pi|"]);
    const usable = all.filter(e => e.chapter === chapterId || !LOCAL_ONLY.has(symKey(expandMacros(e.sym))));
    return { table: buildTable(usable, expandMacros), byId };
  }, [chapterId, notation]);
  // 渲染期同步设置当前符号表（子组件随后渲染时即生效）
  if (ACTIVE.table !== sym.table) ACTIVE = { table: sym.table, ver: ++tableVer };

  // 子组件的 effect 先于父组件执行：此时登记表已完整，刷新一次依赖登记表的组件（路线图、关键方程等）
  useEffect(() => { setVer(v => v + 1); }, []);

  // 点击委托：符号 → 弹卡；公式 → 放大
  useEffect(() => {
    const onClick = e => {
      const s = e.target.closest?.("[data-sym]");
      if (s && s.closest(".tb, .tb-modal")) {
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

// 编号 → 章节 id（"2.23" → ch02，"A.3" → appA）
export function chapterOfNum(n) {
  const head = String(n).split(".")[0];
  if (/^\d+$/.test(head)) return book.chapters.find(c => String(c.no) === head)?.id;
  return book.chapters.find(c => c.id === "app" + head)?.id;
}
const anchor = (kind, n) => `${kind}-${String(n).replace(/[^\w.-]/g, "_")}`;
const hrefTo = (kind, n, here) => pageUrl(chapterOfNum(n) || here, anchor(kind, n));
const chapterName = id => { const c = book.chapters.find(x => x.id === id); return c ? (/^\d+$/.test(String(c.no)) ? `第 ${c.no} 章` : `附录 ${c.no}`) : id; };

// ---------- 符号弹卡 ----------
function SymbolPop({ id, x, y, top, onClose }) {
  const tb = useTextbook();
  const e = tb.sym.byId[id] || tb.sym.byId[tb.chapterId + "-" + id];   // \sym{} 可写本章短 id
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
  // 本章用到该符号的公式
  const uses = [...tb.eqs.current.entries()].filter(([, v]) => v.used?.includes(id)).map(([n]) => n)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return (
    <div className="sym-pop" ref={ref} style={pos} role="dialog">
      <button className="sym-x" onClick={onClose} aria-label="关闭">×</button>
      <div className="sym-head">
        <span className="sym-big" dangerouslySetInnerHTML={{ __html: katex.renderToString(expandMacros(e.sym), { throwOnError: false, macros: { ...macros() } }) }} />
        <span><b><Rich>{e.name}</Rich></b>{e.en && <i className="muted"> {e.en}</i>}</span>
      </div>
      {e.def && <div className="sym-def"><TxI>{e.def}</TxI></div>}
      {e.unit && <div className="sym-row"><span>单位/量纲</span><TxI>{e.unit}</TxI></div>}
      {e.eq && <div className="sym-row"><span>定义见</span><EqRef n={e.eq} />{e.chapter !== tb.chapterId && <span className="muted">（{chapterName(e.chapter)}）</span>}</div>}
      {uses.length > 0 && <div className="sym-row"><span>本章出现</span><span className="sym-uses">{uses.slice(0, 12).map(n => <EqRef key={n} n={n} />)}{uses.length > 12 && <span className="muted"> 等 {uses.length} 处</span>}</span></div>}
    </div>);
}

// ---------- 公式放大 + 逐符号解读 ----------
function EqModal({ tex, n, title, say, onClose }) {
  const tb = useTextbook();
  const ids = symbolsIn(tex);
  const [copied, setCopied] = useState(false);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  return (
    <div className="tb-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tb-modal-card" role="dialog">
        <button className="close" onClick={onClose} aria-label="关闭">×</button>
        <div className="tb-modal-h">{n ? `式 (${n})` : "公式"}{title && <> · <Rich>{title}</Rich></>}</div>
        <div className="tb-modal-eq"><EqLine tex={tex} n={n} min={0.45} /></div>
        {say && <div className="tb-modal-say">🗣 <TxI>{say}</TxI></div>}
        {ids.length > 0 && <>
          <div className="tb-modal-sub">式中符号（点击公式中的符号也可查看）</div>
          <table className="tb-table tb-symlist"><tbody>{ids.map(id => {
            const e = tb.sym.byId[id] || tb.sym.byId[tb.chapterId + "-" + id]; if (!e) return null;
            return <tr key={id}>
              <td className="sym-cell" dangerouslySetInnerHTML={{ __html: katex.renderToString(expandMacros(e.sym), { throwOnError: false, macros: { ...macros() } }) }} />
              <td><b><Rich>{e.name}</Rich></b></td><td><TxI>{e.def || ""}</TxI>{e.eq && <> · 见 <EqRef n={e.eq} /></>}</td>
            </tr>;
          })}</tbody></table>
        </>}
        <div className="tb-modal-tools">
          {n && <a href={hrefTo("eq", n, tb.chapterId)} onClick={() => onClose()}>↩ 定位到正文</a>}
          <button onClick={() => { navigator.clipboard?.writeText(tex); setCopied(true); }}>{copied ? "已复制" : "复制 LaTeX"}</button>
        </div>
      </div>
    </div>);
}

// 行间公式（编号与原书一致）。
// <Eq n="2.23" keyEq title="Christoffel 符号" say="一句话读法">{String.raw`…`}</Eq>
// keyEq：关键方程（高亮 + 章末汇总）；say：用中文读出这个式子说了什么（放大窗口里显示）。
// 不编号的行间公式省略 n。多行用 \begin{aligned}…\end{aligned}。点击公式可放大，点击符号查看定义。
export function Eq({ n, children, keyEq = false, title, say }) {
  const tb = useTextbook();
  const tex = String(children).trim();
  if (n && tb) tb.register(String(n), { tex, key: keyEq, title, say, used: symbolsIn(tex) });
  return (
    <div className={"eq" + (keyEq ? " eq-key" : "") + (tb ? " eq-click" : "")} id={n ? anchor("eq", n) : undefined}
      data-eqtex={tb ? tex : undefined} data-eqn={n || undefined} data-eqtitle={title || undefined} data-eqsay={say || undefined}>
      {keyEq && title && <div className="eq-title"><Rich>{title}</Rich></div>}
      <EqLine tex={tex} n={n} className="eq-body" />
      {tb && <span className="eq-zoom" title="放大并逐符号解读">⤢</span>}
    </div>);
}

// 引用：公式（悬停预览）、图、节、习题
// 悬浮预览：渲染到 document.body（portal）并按触发元素的屏幕位置 fixed 定位——
// 不会被任何 overflow 容器（可横向滚动的表格、卡片等）裁掉；上方空间不足时改为向下弹出，左右不越出视口。
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
        const here = chapterOfNum(n) === tb?.chapterId || !chapterOfNum(n);
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
    if (!info) return <span className="muted">{chapterName(chapterOfNum(n))} 式 ({n}) — 点击跳转</span>;
    return <EqLine tex={info.tex} n={n} min={0.5} />;
  };
  return <Ref kind="eq" n={n} label={paren ? `(${n})` : n} preview={preview} />;
}
export const FigRef = ({ n }) => <Ref kind="fig" n={n} label={`图 ${n}`} preview={() => <img src={assetUrl(`figures/fig-${n}.png`)} alt="" style={{ maxWidth: 360, display: "block" }} />} />;
export const SecRef = ({ n }) => <Ref kind="sec" n={n} label={`§${n}`} />;
export const ExRef = ({ n }) => <Ref kind="ex" n={n} label={`习题 ${n}`} />;
export { anchor };

// ---------- 带公式的正文 ----------
// <Tx>{String.raw`标度因子 $a(t)$ 满足 \eqref{2.23}，见 \figref{2.3}、\secref{2.1.1}、\exref{2.4}。**粗体** *强调*`}</Tx>
// 空行分段；$$...$$ 为不编号的行间公式（同样可点击放大）。
// 行内记号。书可以用 extendInline 注册自己的引用记号（如论文书的 \sref{L2.1}），全站所有支持公式的地方随之生效。
const BASE_TOKENS = [String.raw`\$\$[\s\S]+?\$\$`, String.raw`\$[^$]+?\$`, String.raw`\\eqref\{[^}]+\}`, String.raw`\\figref\{[^}]+\}`, String.raw`\\secref\{[^}]+\}`, String.raw`\\exref\{[^}]+\}`, String.raw`\*\*[^*]+?\*\*`, String.raw`\*[^*\s][^*]*?\*`];
const EXT = [];       // [{ name, render(arg, key) }]：记号形如 \name{arg}
let TOKEN = new RegExp(`(${BASE_TOKENS.join("|")})`, "g");
let RICH = /\$[^$]+\$|\\(eqref|figref|secref|exref)\{/;      // 含这些记号的字符串才按"富文本"解析（见 Rich）
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
// 只解析行内标记、不分段（用于标题、表格单元格、按钮等）
export const TxI = ({ children }) => <>{inline(String(children ?? ""), "i")}</>;

// ---------- 富文本：只在需要时解析公式 ----------
// 字符串含 $…$ 或 \eqref 类记号时按 TxI/Tx 渲染（KaTeX + 引用），否则原样输出——不含公式的人文书文本完全不受影响。
// 非字符串（JSX）原样返回。框架中原本只渲染纯文本的地方（Hook、Bridge、概念卡、Takeaways、Quiz、Roadmap、Plot 图注、书架…）都经过它。
export const needsRich = s => typeof s === "string" && RICH.test(s);
export function Rich({ children }) {
  const s = children;
  if (typeof s !== "string") return s ?? null;
  return needsRich(s) ? <TxI>{s}</TxI> : s;
}
// 分段版本（\n\n 分段）：替代 core.jsx 的 Paras
export function RichParas({ text }) {
  if (text != null && typeof text !== "string") return text;
  const t = String(text ?? "");
  if (needsRich(t)) return <Tx>{t}</Tx>;
  return t.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>);
}
// 用于 title 属性等只能放纯文本的地方：去掉 $ 与 \命令
export const plainText = s => (typeof s === "string" ? s.replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "") : "");

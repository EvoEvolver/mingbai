import { useEffect, useMemo, useState } from "react";
import { book, modules, allConcepts, crossLinks, chapterGroups } from "./book.jsx";
import { ChapterProvider, ConceptChip } from "./core.jsx";
import { Rich } from "./math/tex.jsx";

// 整章外壳：上下文 + 进度条 + 侧边目录 + 开篇 Hero + 章节导航。
// children 里用 <Block> 组织区块，带 toc 的 Block 会自动进入侧边目录。
export function ChapterPage({ meta, groups, concepts, relations, children }) {
  useEffect(() => { document.title = `${meta.title_zh} · ${book.title}`; }, [meta]);
  const extra = useMemo(() => allConcepts(), []);
  return (
    <ChapterProvider meta={meta} groups={groups} concepts={concepts} relations={relations} extra={extra}>
      <Progress />
      <TopBar id={meta.id} />
      <Toc />
      <main>
        <Hero meta={meta} conceptCount={concepts?.length || 0} />
        {children}
        <CrossLinks id={meta.id} />
        <ChapterNav id={meta.id} />
        <footer>本页为原著的导读与改写，仅供学习。概念提炼与类比为编者解释，以原著为准。</footer>
      </main>
    </ChapterProvider>);
}

export function Block({ id, kicker, title, lead, toc, children, className = "" }) {
  return (
    <section className={"block " + className} id={id ? "b-" + id : undefined} data-toc={toc || undefined}>
      {kicker && <div className="kicker">{kicker}</div>}
      {title && <h2><Rich>{title}</Rich></h2>}
      {lead && <p className="lead"><Rich>{lead}</Rich></p>}
      {children}
    </section>);
}

export function Hero({ meta: m, conceptCount }) {
  const label = m.no === 0 ? m.title_zh : `第 ${m.no} 章`;
  return (
    <header className="hero" id="b-top" data-toc="开篇">
      <div className="chno">{String(m.no).padStart(2, "0")}</div>
      <div className="kicker">{book.author} · {book.title} · {label}{m.era ? " · " + m.era : ""}</div>
      <h1>{m.title_zh}</h1><div className="en">{m.title_en}</div>
      <div className="one"><Rich>{m.one_liner}</Rich></div>
      <div className="stats">
        {m.original_words && <div className="stat"><b>{Number(m.original_words).toLocaleString()}</b><small>原著英文词数</small></div>}
        <div className="stat arrow">→</div>
        <div className="stat"><b>{conceptCount}</b><small>个核心概念</small></div>
        {m.read_minutes && <div className="stat"><b>{m.read_minutes} 分钟</b><small>读懂本章</small></div>}
      </div>
      {m.big_question && <div className="bigq"><small>本章真正的问题</small><Rich>{m.big_question}</Rich></div>}
      {m.why_it_matters && <p className="why"><Rich>{m.why_it_matters}</Rich></p>}
      <div className="scrollhint">↓ 往下滚动</div>
    </header>);
}

export function Progress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const f = () => { const h = document.documentElement; setW(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100); };
    addEventListener("scroll", f, { passive: true }); f();
    return () => removeEventListener("scroll", f);
  }, []);
  return <div id="progress" style={{ width: w + "%" }} />;
}

// 扫描 DOM 中带 data-toc 的区块生成目录
export function Toc() {
  const [items, setItems] = useState([]), [cur, setCur] = useState(0);
  useEffect(() => {
    const els = [...document.querySelectorAll("[data-toc]")];
    setItems(els.map(e => ({ el: e, label: e.dataset.toc })));
    const f = () => { let c = 0; els.forEach((e, i) => { if (e.getBoundingClientRect().top < innerHeight * .4) c = i; }); setCur(c); };
    addEventListener("scroll", f, { passive: true }); f();
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <nav id="toc">{items.map((it, i) =>
      <a key={i} href="#" onClick={e => { e.preventDefault(); it.el.scrollIntoView({ behavior: "smooth" }); }} className={i === cur ? "on" : ""}><i /><span>{it.label}</span></a>)}
    </nav>);
}

const chName = c => (c.no === 0 ? c.title_zh : `第 ${c.no} 章 · ${c.title_zh}`);

// 固定顶栏：返回书架 + 章节跳转下拉 + 上一章/下一章。向下滚动时收起，向上滚动时出现。
export function TopBar({ id }) {
  const i = book.chapters.findIndex(c => c.id === id);
  const prev = book.chapters[i - 1], next = book.chapters[i + 1];
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = scrollY;
    const f = () => { const y = scrollY; setHidden(y > 120 && y > last); last = y; };
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <div className={"topbar" + (hidden ? " hide" : "")}>
      <a className="tb-home" href="#/" title="返回书架">← <b>{book.title}</b><span> · 全部章节</span></a>
      <select className="tb-jump" value={id} onChange={e => { location.hash = "#/" + e.target.value; }} aria-label="跳转章节">
        {book.chapters.map(c => <option key={c.id} value={c.id}>{chName(c)}</option>)}
        {modules.connections && <option value="connections">🧭 全书脉络</option>}
      </select>
      <span className="tb-nav">
        {prev ? <a href={`#/${prev.id}`} title={chName(prev)}>← 上一章</a> : <span />}
        {next ? <a href={`#/${next.id}`} title={chName(next)}>下一章 →</a> : <span />}
      </span>
    </div>);
}

export function ChapterNav({ id }) {
  const i = book.chapters.findIndex(c => c.id === id);
  const prev = book.chapters[i - 1], next = book.chapters[i + 1];
  const name = c => c.no === 0 ? c.title_zh : `第 ${c.no} 章 · ${c.title_zh}`;
  return (
    <nav className="chnav">
      {prev ? <a href={`#/${prev.id}`}>← {name(prev)}</a> : <span />}
      {modules.connections ? <a href="#/connections">全书脉络</a> : <a href="#/">目录</a>}
      {next ? <a href={`#/${next.id}`}>{name(next)} →</a> : <span />}
    </nav>);
}

// 本章与其他章节的联系（数据来自 chapters/connections.jsx 的 links）
function CrossLinks({ id }) {
  const links = crossLinks().filter(l => l.from.startsWith(id + ":") || l.to.startsWith(id + ":"));
  if (!links.length) return null;
  return (
    <Block id="xlinks" toc="跨章联系" kicker="全书脉络" title="这一章和其他章节的联系" lead="点击概念查看解释；带 📖 的可跳到对应章节。">
      <div className="xlinks">{links.map((l, i) => {
        return <div className="card xl" key={i}>
          <div className="xl-row"><ConceptChip id={l.from} /> <span className="xl-lab">{l.label} →</span> <ConceptChip id={l.to} /></div>
          {l.note && <p>{l.note}</p>}
        </div>;
      })}</div>
      <p><a href="#/connections">🧭 查看全书脉络 →</a></p>
    </Block>);
}

// 全书层面的页面外壳（如全书脉络页）：所有章节概念都可用 <C id="ch03:mathesis"> 引用，
// <ConceptMap edges=[...]> 可画跨章关系图（按章节配色）。
export function BookPage({ title, subtitle, lead, children }) {
  useEffect(() => { document.title = `${title} · ${book.title}`; }, [title]);
  const concepts = useMemo(() => allConcepts(), []);
  const groups = useMemo(() => chapterGroups(), []);
  return (
    <ChapterProvider meta={{ id: "book", title_zh: title }} groups={groups} concepts={concepts} relations={crossLinks()}>
      <Progress />
      <TopBar id="connections" />
      <Toc />
      <main>
        <header className="hero" id="b-top" data-toc="开篇" style={{ minHeight: "60vh" }}>
          <div className="kicker">{book.author} · {book.title} · 全书</div>
          <h1>{title}</h1>{subtitle && <div className="en">{subtitle}</div>}
          {lead && <div className="one">{lead}</div>}
        </header>
        {children}
        <footer>本页为原著的导读与改写，仅供学习。</footer>
      </main>
    </ChapterProvider>);
}

import { t } from "./i18n/index.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { book, modules, allConcepts, crossLinks, chapterGroups, chapterLabel, hasChapter, pageUrl, go, titleOf, useLibrary } from "./book.jsx";
import { ChapterProvider, ConceptChip } from "./core.jsx";
import { Rich } from "./math/tex.jsx";

// 整章外壳：上下文 + 进度条 + 侧边目录 + 开篇 Hero + 章节导航。
// children 里用 <Block> 组织区块，带 toc 的 Block 会自动进入侧边目录。
export function ChapterPage({ meta, groups, concepts, relations, children }) {
  useEffect(() => { document.title = `${titleOf(meta)} · ${book.title}`; }, [meta]);
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
        <footer>{t("footer.chapter")}</footer>
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
  const label = m.no === 0 ? titleOf(m) : t("ch.no", m.no);
  return (
    <header className="hero" id="b-top" data-toc={t("toc.top")}>
      <div className="chno">{String(m.no).padStart(2, "0")}</div>
      <div className="kicker">{book.author} · {book.title} · {label}{m.era ? " · " + m.era : ""}</div>
      <h1>{titleOf(m)}</h1>{m.title_zh && <div className="en">{m.title_en}</div>}
      <div className="one"><Rich>{m.one_liner}</Rich></div>
      <div className="stats">
        {m.original_words && <div className="stat"><b>{Number(m.original_words).toLocaleString()}</b><small>{t("hero.words")}</small></div>}
        <div className="stat arrow">→</div>
        <div className="stat"><b>{conceptCount}</b><small>{t("hero.concepts")}</small></div>
        {m.read_minutes && <div className="stat"><b>{t("hero.minutes", m.read_minutes)}</b><small>{t("hero.readTime")}</small></div>}
      </div>
      {m.big_question && <div className="bigq"><small>{t("hero.bigq")}</small><Rich>{m.big_question}</Rich></div>}
      {m.why_it_matters && <p className="why"><Rich>{m.why_it_matters}</Rich></p>}
      <div className="scrollhint">{t("hero.scroll")}</div>
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

// 扫描 DOM 中带 data-toc 的区块生成目录（层级见 data-toc-level，缺省 1）。
// 平时是页面右侧的一列横杠，长度表示层级、高亮表示当前位置；悬停或键盘聚焦时展开成标题面板（纯 CSS，见 style.css）。
export function Toc() {
  const [items, setItems] = useState([]), [cur, setCur] = useState(0);
  const panel = useRef(null);
  useEffect(() => {
    const els = [...document.querySelectorAll("[data-toc]")];
    setItems(els.map(e => ({ el: e, label: e.dataset.toc, level: +e.dataset.tocLevel || 1 })));
    const f = () => { let c = 0; els.forEach((e, i) => { if (e.getBoundingClientRect().top < innerHeight * .4) c = i; }); setCur(c); };
    addEventListener("scroll", f, { passive: true }); f();
    return () => removeEventListener("scroll", f);
  }, []);
  // 面板较长时，让当前项保持在可见范围内（只滚动面板自身，不影响页面）
  useEffect(() => {
    const p = panel.current, a = p?.children[cur];
    if (a && (a.offsetTop < p.scrollTop || a.offsetTop + a.offsetHeight > p.scrollTop + p.clientHeight)) p.scrollTop = a.offsetTop - p.clientHeight / 2;
  }, [cur, items]);
  if (items.length < 2) return null;
  return (
    <nav id="toc" aria-label={t("toc.label")} style={{ "--n": items.length }}>
      <div className="toc-rail" aria-hidden="true">{items.map((it, i) =>
        <i key={i} className={`toc-bar l${it.level}${i === cur ? " on" : ""}`} />)}
      </div>
      <div className="toc-panel" ref={panel}>{items.map((it, i) =>
        <a key={i} href={it.el.id ? "#" + it.el.id : "#"} className={`toc-item l${it.level}${i === cur ? " on" : ""}`} aria-current={i === cur ? "location" : undefined}
          onClick={e => { e.preventDefault(); it.el.scrollIntoView({ behavior: "smooth" }); }}><span>{it.label}</span></a>)}
      </div>
    </nav>);
}

// 固定顶栏：返回书架 + 章节跳转下拉 + 上一章/下一章。向下滚动时收起，向上滚动时出现。
export function TopBar({ id }) {
  const i = id ? book.chapters.findIndex(c => c.id === id) : -1;
  const prev = i >= 0 ? book.chapters[i - 1] : null, next = i >= 0 ? book.chapters[i + 1] : null;
  const lib = useLibrary();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = scrollY;
    const f = () => { const y = scrollY; setHidden(y > 120 && y > last); last = y; };
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <div className={"topbar" + (hidden ? " hide" : "")}>
      {lib && <a className="tb-lib" href={lib} title={t("nav.libraryTitle")}>{t("nav.library")}</a>}
      {lib && <span className="tb-sep">›</span>}
      {id
        ? <a className="tb-home" href={pageUrl(null)} title={t("nav.bookTitle")}>{lib ? "" : "← "}<b>{book.title}</b><span>{t("nav.allChapters")}</span></a>
        : <span className="tb-home tb-cur"><b>{book.title}</b></span>}
      <select className="tb-jump" value={id || ""} onChange={e => go(e.target.value)} aria-label={t("nav.jump")}>
        {!id && <option value="" disabled>{t("nav.jumpTo")}</option>}
        {book.chapters.filter(c => hasChapter(c.id)).map(c => <option key={c.id} value={c.id}>{chapterLabel(c)}</option>)}
        {hasChapter("connections") && <option value="connections">{t("nav.connectionsIcon")}</option>}
      </select>
      {id && <span className="tb-nav">
        {prev && hasChapter(prev.id) ? <a href={pageUrl(prev.id)} title={chapterLabel(prev)}>{t("nav.prev")}</a> : <span />}
        {next && hasChapter(next.id) ? <a href={pageUrl(next.id)} title={chapterLabel(next)}>{t("nav.next")}</a> : <span />}
      </span>}
    </div>);
}

export function ChapterNav({ id }) {
  const i = book.chapters.findIndex(c => c.id === id);
  const prev = book.chapters[i - 1], next = book.chapters[i + 1];
  return (
    <nav className="chnav">
      {prev ? <a href={pageUrl(prev.id)}>← {chapterLabel(prev)}</a> : <span />}
      {hasChapter("connections") ? <a href={pageUrl("connections")}>{t("nav.connections")}</a> : <a href={pageUrl(null)}>{t("nav.contents")}</a>}
      {next ? <a href={pageUrl(next.id)}>{chapterLabel(next)} →</a> : <span />}
    </nav>);
}

// 本章与其他章节的联系（数据来自 chapters/connections.jsx 的 links）
function CrossLinks({ id }) {
  const links = crossLinks().filter(l => l.from.startsWith(id + ":") || l.to.startsWith(id + ":"));
  if (!links.length) return null;
  return (
    <Block id="xlinks" toc={t("xlinks.toc")} kicker={t("xlinks.kicker")} title={t("xlinks.title")} lead={t("xlinks.lead")}>
      <div className="xlinks">{links.map((l, i) => {
        return <div className="card xl" key={i}>
          <div className="xl-row"><ConceptChip id={l.from} /> <span className="xl-lab">{l.label} →</span> <ConceptChip id={l.to} /></div>
          {l.note && <p>{l.note}</p>}
        </div>;
      })}</div>
      <p><a href={pageUrl("connections")}>{t("xlinks.more")}</a></p>
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
        <header className="hero" id="b-top" data-toc={t("toc.top")} style={{ minHeight: "60vh" }}>
          <div className="kicker">{book.author} · {book.title} · {t("book.whole")}</div>
          <h1>{title}</h1>{subtitle && <div className="en">{subtitle}</div>}
          {lead && <div className="one">{lead}</div>}
        </header>
        {children}
        <footer>{t("footer.book")}</footer>
      </main>
    </ChapterProvider>);
}

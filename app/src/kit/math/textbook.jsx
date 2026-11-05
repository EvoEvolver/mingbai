import { t } from "../i18n/index.js";
import { useEffect } from "react";
import { book, chapterNo, pageUrl } from "../book.jsx";
import { Progress, Toc, TopBar, ChapterNav } from "../layout.jsx";
import { ChapterProvider } from "../core.jsx";
import { TextbookProvider, Tx, TxI, Rich } from "./tex.jsx";
import { KeyEquations, Notation } from "./env.jsx";

// 教科书章节外壳。
// meta: { id, no, title_en, title_zh, pages:"21–56",
//         one_liner（一句话说清本章）, big_question（本章真正要回答的问题）, why_it_matters,
//         overview（可含 $…$）, objectives:[...], prereq:[{ch, what}] }
// notation: 本章符号词典（公式中的符号据此可点击；也渲染为章末符号表）
// groups / concepts / relations: 核心物理概念（与人文版同一格式，可用 <ConceptGrid/>、<ConceptMap/>、<C id>）
export function TextbookPage({ meta: m, notation = [], groups, concepts, relations, children, keyEquations = true }) {
  useEffect(() => { document.title = `${m.no ? m.no + " " : ""}${m.title_zh || m.title_en} · ${book.title}`; }, [m]);
  const label = chapterNo({ no: m.no, label: m.label ?? book.chapters?.find(c => c.id === m.id)?.label });   // label 可覆盖（如“第 I 章补充”）
  return (
    <ChapterProvider meta={m} groups={groups} concepts={concepts} relations={relations}>
      <TextbookProvider chapterId={m.id} notation={notation}>
        <Progress />
        <TopBar id={m.id} />
        <Toc />
        <main className="tb">
          <header className="tb-hero" id="b-top" data-toc={t("toc.overview")}>
            <div className="kicker">{book.author} · {book.title} · {label}{m.pages ? t("tb.pages", m.pages) : ""}</div>
            <h1>{m.no ? <span className="tb-chno">{m.no}</span> : null}{m.title_zh || m.title_en}</h1>
            {m.title_zh && <div className="en">{m.title_en}</div>}
            {m.one_liner && <div className="one"><TxI>{m.one_liner}</TxI></div>}
            {m.big_question && <div className="bigq"><small>{t("hero.bigq")}</small><TxI>{m.big_question}</TxI></div>}
            {m.why_it_matters && <p className="why"><TxI>{m.why_it_matters}</TxI></p>}
            {m.overview && <div className="tb-overview"><Tx>{m.overview}</Tx></div>}
            <div className="tb-meta-row">
              {m.objectives?.length > 0 && <div className="tb-obj"><b>{t("tb.objectives")}</b><ul>{m.objectives.map((o, i) => <li key={i}><TxI>{o}</TxI></li>)}</ul></div>}
              {m.prereq?.length > 0 && <div className="tb-pre"><b>{t("tb.prereq")}</b><ul>{m.prereq.map((p, i) => <li key={i}>{p.ch ? <a href={pageUrl(p.ch)}><Rich>{p.what}</Rich></a> : <TxI>{p.what}</TxI>}</li>)}</ul></div>}
            </div>
            <div className="tb-tip">{t("tb.tip")}</div>
          </header>
          {children}
          {keyEquations && <section className="tb-sec" id="b-keyeq" data-toc={t("toc.keyeq")}>
            <h2 className="tb-h2">{t("tb.keyeq")}</h2>
            <p className="lead">{t("tb.keyeqLead")}</p>
            <KeyEquations />
          </section>}
          {notation?.length > 0 && <section className="tb-sec" id="b-notation" data-toc={t("toc.notation")}>
            <h2 className="tb-h2">{t("tb.notation")}</h2>
            <Notation rows={notation} />
          </section>}
          <ChapterNav id={m.id} />
          <footer>{book.footer ?? t("footer.textbook")}</footer>
        </main>
      </TextbookProvider>
    </ChapterProvider>);
}

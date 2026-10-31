import { useEffect } from "react";
import { book } from "../book.jsx";
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
  const label = /^\d+$/.test(String(m.no)) ? `第 ${m.no} 章` : `附录 ${m.no}`;
  return (
    <ChapterProvider meta={m} groups={groups} concepts={concepts} relations={relations}>
      <TextbookProvider chapterId={m.id} notation={notation}>
        <Progress />
        <TopBar id={m.id} />
        <Toc />
        <main className="tb">
          <header className="tb-hero" id="b-top" data-toc="本章概览">
            <div className="kicker">{book.author} · {book.title} · {label}{m.pages ? ` · 原书 pp. ${m.pages}` : ""}</div>
            <h1><span className="tb-chno">{m.no}</span>{m.title_zh || m.title_en}</h1>
            {m.title_zh && <div className="en">{m.title_en}</div>}
            {m.one_liner && <div className="one"><TxI>{m.one_liner}</TxI></div>}
            {m.big_question && <div className="bigq"><small>本章真正的问题</small><TxI>{m.big_question}</TxI></div>}
            {m.why_it_matters && <p className="why"><TxI>{m.why_it_matters}</TxI></p>}
            {m.overview && <div className="tb-overview"><Tx>{m.overview}</Tx></div>}
            <div className="tb-meta-row">
              {m.objectives?.length > 0 && <div className="tb-obj"><b>学完本章你应当能够</b><ul>{m.objectives.map((o, i) => <li key={i}><TxI>{o}</TxI></li>)}</ul></div>}
              {m.prereq?.length > 0 && <div className="tb-pre"><b>前置知识</b><ul>{m.prereq.map((p, i) => <li key={i}>{p.ch ? <a href={`#/${p.ch}`}><Rich>{p.what}</Rich></a> : <TxI>{p.what}</TxI>}</li>)}</ul></div>}
            </div>
            <div className="tb-tip">💡 点击任一公式可放大并逐符号解读；点击公式中的符号可直接查看定义。</div>
          </header>
          {children}
          {keyEquations && <section className="tb-sec" id="b-keyeq" data-toc="关键方程">
            <h2 className="tb-h2">本章关键方程</h2>
            <p className="lead">点击任一方程跳回正文所在位置。</p>
            <KeyEquations />
          </section>}
          {notation?.length > 0 && <section className="tb-sec" id="b-notation" data-toc="符号表">
            <h2 className="tb-h2">本章符号表</h2>
            <Notation rows={notation} />
          </section>}
          <ChapterNav id={m.id} />
          <footer>本页为原书的中文学习版：结构、公式编号与插图依原书，正文为编者重新组织的讲解。插图版权归原书出版方所有，仅供个人学习。</footer>
        </main>
      </TextbookProvider>
    </ChapterProvider>);
}

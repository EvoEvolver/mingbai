import { useEffect } from "react";
import { book, modules, hasChapter, pageUrl } from "./kit/book.jsx";
import { Rich } from "./kit/math/tex.jsx";

export default function Shelf() {
  useEffect(() => { document.title = `${book.title} · 图书讲透`; }, []);
  return (
    <main>
      <header className="hero" style={{ minHeight: "52vh" }}>
        <div className="kicker">{book.author} · {book.subtitle}</div>
        <h1>{book.title}</h1><div className="en">{book.title_en}</div>
        <div className="one"><Rich>{book.intro}</Rich></div>
        {hasChapter("connections") && <p><a className="cta" href={pageUrl("connections")}>🧭 全书脉络：章节之间如何连接 →</a></p>}
      </header>
      <div className="shelf">
        {book.parts.map(p => [
          <div className="part" key={"p" + p.no}>{p.label}</div>,
          ...book.chapters.filter(c => c.part === p.no).map(c => {
            const meta = modules[c.id]?.meta, ready = hasChapter(c.id);
            return (
              <a key={c.id} className={"ch" + (ready ? " ready" : "")} href={ready ? pageUrl(c.id) : undefined}>
                {!ready && <span className="tag">制作中</span>}
                <div className="n">{c.no === 0 ? "序" : c.no}</div><h3>{c.title_zh}</h3><div className="e">{c.title_en}</div>
                {meta?.one_liner && <div className="one"><Rich>{meta.one_liner}</Rich></div>}
              </a>);
          })])}
      </div>
      <footer>图书讲透 · 把晦涩原著拆成核心概念 + 类比 + 互动</footer>
    </main>);
}

import { t } from "./kit/i18n/index.js";
import { useEffect, useState } from "react";
import { book, modules, hasChapter, pageUrl, titleOf } from "./kit/book.jsx";
import { Rich } from "./kit/math/tex.jsx";
import { TopBar } from "./kit/layout.jsx";

export default function Shelf() {
  useEffect(() => { document.title = `${book.title} · ${t("site.brand")}`; }, []);
  return (
    <main>
      <TopBar id={null} />
      <header className="hero" style={{ minHeight: "52vh" }}>
        <div className="kicker">{book.author} · {book.subtitle}</div>
        <h1>{book.title}</h1>{book.title_en && book.title_en !== book.title && <div className="en">{book.title_en}</div>}
        <div className="one"><Rich>{book.intro}</Rich></div>
        {hasChapter("connections") && <p><a className="cta" href={pageUrl("connections")}>{t("shelf.connections")}</a></p>}
      </header>
      <div className="shelf">
        {(book.parts?.length ? book.parts : [{ no: null, label: null }]).map(p => [   // 未分部（如论文）时列成一组
          p.label && <div className="part" key={"p" + p.no}>{p.label}</div>,
          ...book.chapters.filter(c => p.no === null || c.part === p.no).map(c => {
            const meta = modules[c.id]?.meta, ready = hasChapter(c.id);
            return (
              <a key={c.id} className={"ch" + (ready ? " ready" : "")} href={ready ? pageUrl(c.id) : undefined}>
                {!ready && <span className="tag">{t("shelf.wip")}</span>}
                <div className="n">{c.no === 0 ? (c.label ? book.chapters.indexOf(c) + 1 : t("shelf.preface")) : c.no}</div><h3>{titleOf(c)}</h3>{c.title_zh && <div className="e">{c.title_en}</div>}
                {meta?.one_liner && <div className="one"><Rich>{meta.one_liner}</Rich></div>}
              </a>);
          })])}
      </div>
      <footer>{t("shelf.footer")}</footer>
    </main>);
}

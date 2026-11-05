import { book, available, data, anchors } from "virtual:book";
import { t } from "./i18n/index.js";
export { anchors };

// Book-level data and link utilities (multi-page static site).
//
// Each chapter is a separate page <chapterId>/index.html that loads only its own code. Cross-chapter data is extracted at build time (see vite.config.js):
//   modules[id]      — any chapter's data: { meta, notation, groups, concepts, relations, links };
//                       the current page's chapter is the full module (with the default component too). Forms like modules[id]?.meta still work.
//   available        — chapter ids included in this build; hasChapter(id)
//   currentPage()    — current page's chapter id (null on the shelf)
//   pageUrl(id, a)   — relative link to a chapter (optionally with in-page anchor a, e.g. "eq-2.23"); a null id points to the shelf.
//                       Returns only "#a" on the same page. All internal links should use it (it works under any deployment subpath, e.g. GitHub Pages).
// Cross-chapter concept ids look like "ch03:mathesis".
export const modules = { ...data };
let PAGE = null;
export function setPage(id, mod) {
  PAGE = id;
  if (id && mod) modules[id] = { ...(data[id] || {}), ...mod };
}
export const currentPage = () => PAGE;
// Relative path to a book's static asset (a file under public/, e.g. "figures/fig-2.3.png"): chapter pages are in a subdirectory, so go up one level
export const assetUrl = p => (/^(https?:|data:|\/)/.test(p) ? p : (PAGE ? "../" : "./") + p);
export const hasChapter = id => available.includes(id);

// Chapter pages live in <id>/, the shelf at the root
export function pageUrl(id, anchor) {
  const hash = anchor ? "#" + anchor : "";
  if ((id || null) === PAGE) return hash || "#";
  const up = PAGE ? "../" : "./";
  return id ? `${up}${id}/${hash}` : `${up}${hash}`;
}
// Old-style hash route "#/ch02/eq-2.23" → new link
export function legacyHashUrl(h) {
  const m = String(h).match(/^#\/([^/]*)\/?(.*)$/);
  if (!m) return null;
  return pageUrl(m[1] || null, m[2] ? decodeURIComponent(m[2]) : "");
}
export const go = (id, anchor) => { location.href = pageUrl(id, anchor); };

// Whether deployed in a library: build-library.sh injects <meta name="book-library"> into every page when assembling the library (no request, so no 404 when deployed alone).
// Returns the relative link to the library home page, otherwise null.
export function useLibrary() {
  if (typeof document === "undefined" || !document.querySelector('meta[name="book-library"]')) return null;
  return (PAGE ? "../" : "./") + "../";
}

// Primary display name of a content field: Chinese books write *_zh (with *_en as subtitle); English books write only *_en.
export const titleOf = x => x?.title_zh || x?.title_en || "";
export const nameOf = c => c?.name_zh || c?.name_en || "";
// Chapter label: can be overridden by label; non-numeric numbers are treated as appendices ("A" → Appendix A)
export const chapterNo = c => c.label ?? (/^\d+$/.test(String(c.no)) ? t("ch.no", c.no) : t("ch.appendix", c.no));
export const chapterLabel = c => (c.no === 0 ? titleOf(c) : `${chapterNo(c)} · ${titleOf(c)}`);

let conceptCache = null;
// Concepts of all chapters, with ids prefixed by chapter and group = chapter id
export function allConcepts() {
  if (conceptCache) return conceptCache;
  const out = [];
  for (const ch of book.chapters) {
    const m = modules[ch.id];
    if (!m?.concepts) continue;
    for (const c of m.concepts) out.push({ ...c, id: `${ch.id}:${c.id}`, localId: c.id, group: ch.id, chapter: { id: ch.id, label: chapterLabel(ch) } });
  }
  return (conceptCache = out);
}
export const chapterGroups = () => book.chapters.filter(c => hasChapter(c.id)).map(c => ({ id: c.id, label: chapterLabel(c) }));
// Cross-chapter connections exported by connections.jsx: [{from:"ch02:signature", to:"ch03:binary_sign", label, note}]
export const crossLinks = () => modules.connections?.links || [];
export { book, available };

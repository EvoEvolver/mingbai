import { book, available, data } from "virtual:book";

// 全书层面的数据与链接工具（多页静态站点）。
//
// 每章是一个独立页面 <章节id>/index.html，只加载本章代码。跨章数据在构建时提取（见 vite.config.js）：
//   modules[id]      —— 任一章节的数据：{ meta, notation, groups, concepts, relations, links }；
//                       当前页的章节则是完整模块（另含 default 组件）。modules[id]?.meta 等写法照旧可用。
//   available        —— 本次构建包含的章节 id；hasChapter(id)
//   currentPage()    —— 当前页章节 id（书架为 null）
//   pageUrl(id, a)   —— 指向某章（可带页内锚点 a，如 "eq-2.23"）的相对链接；id 为 null 指向书架。
//                       同页时只返回 "#a"。所有站内链接都应该用它（适配任意部署子路径，如 GitHub Pages）。
// 跨章概念 id 形如 "ch03:mathesis"。
export const modules = { ...data };
let PAGE = null;
export function setPage(id, mod) {
  PAGE = id;
  if (id && mod) modules[id] = { ...(data[id] || {}), ...mod };
}
export const currentPage = () => PAGE;
export const hasChapter = id => available.includes(id);

// 章节页位于 <id>/，书架位于根目录
export function pageUrl(id, anchor) {
  const hash = anchor ? "#" + anchor : "";
  if ((id || null) === PAGE) return hash || "#";
  const up = PAGE ? "../" : "./";
  return id ? `${up}${id}/${hash}` : `${up}${hash}`;
}
// 旧式哈希路由 "#/ch02/eq-2.23" → 新链接
export function legacyHashUrl(h) {
  const m = String(h).match(/^#\/([^/]*)\/?(.*)$/);
  if (!m) return null;
  return pageUrl(m[1] || null, m[2] ? decodeURIComponent(m[2]) : "");
}
export const go = (id, anchor) => { location.href = pageUrl(id, anchor); };

export const chapterLabel = c => (c.no === 0 ? c.title_zh : `第 ${c.no} 章 · ${c.title_zh}`);

let conceptCache = null;
// 全书各章的概念，id 加章节前缀，group = 章节 id
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
// connections.jsx 导出的跨章联系 [{from:"ch02:signature", to:"ch03:binary_sign", label, note}]
export const crossLinks = () => modules.connections?.links || [];
export { book, available };

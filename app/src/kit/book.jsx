import { book, modules } from "virtual:book";

// 全书层面的数据工具。跨章概念 id 形如 "ch03:mathesis"。
export const chapterLabel = c => (c.no === 0 ? c.title_zh : `第 ${c.no} 章 · ${c.title_zh}`);

let cache;
// 所有已上线章节的概念，id 加章节前缀，group = 章节 id
export function allConcepts() {
  if (cache) return cache;
  cache = [];
  for (const ch of book.chapters) {
    const m = modules[ch.id];
    if (!m?.concepts) continue;
    for (const c of m.concepts) cache.push({ ...c, id: `${ch.id}:${c.id}`, localId: c.id, group: ch.id, chapter: { id: ch.id, label: chapterLabel(ch) } });
  }
  return cache;
}
export const chapterGroups = () => book.chapters.filter(c => modules[c.id]).map(c => ({ id: c.id, label: chapterLabel(c) }));
// connections.jsx 导出的跨章联系 [{from:"ch02:signature", to:"ch03:binary_sign", label, note}]
export const crossLinks = () => modules.connections?.links || [];
export { book, modules };

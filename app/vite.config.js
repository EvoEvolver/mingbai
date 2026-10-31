import { defineConfig, createServer } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// 多页静态站点（GitHub Pages 友好）：
//   <outDir>/index.html            书架
//   <outDir>/<章节id>/index.html   每章一个真实页面（只加载本章代码；公共依赖自动拆成共享块）
// 所有链接与资源都用相对路径，可部署在任意子路径（如 user.github.io/repo/）。
//
// 环境变量：BOOK=<书目录>（默认 ../../oot）；ONLY=ch03 或 ch01,ch02 只构建这些章；OUT=<输出目录>（默认 <书>/dist）。
//
// 跨章数据（各章 meta / notation / concepts / groups / relations / links）在构建时用 SSR 加载章节模块提取，
// 作为 virtual:book 的 data 注入每个页面——书架、跨章联系、跨章符号、全书脉络页都由它提供，无需加载其他章节代码。
const APP = import.meta.dirname;
const BOOK = path.resolve(process.env.BOOK || path.join(APP, "../../oot"));
const ONLY = process.env.ONLY;
const CHAPTERS = path.join(BOOK, "chapters");
const GEN = path.join(APP, ".pages", path.basename(BOOK) + (ONLY ? "-" + ONLY.replace(/,/g, "_") : ""));
const DATA_KEYS = ["meta", "notation", "groups", "concepts", "relations", "links"];

const alias = [
  { find: "@kit", replacement: path.join(APP, "src/kit") },
  // 章节文件位于书目录（框架之外），统一从框架的 node_modules 解析 react
  { find: /^(react|react-dom)(\/.*)?$/, replacement: path.join(APP, "node_modules/$1$2") },
];

const chapterIds = () => fs.readdirSync(CHAPTERS).filter(f => /\.jsx$/.test(f) && !f.startsWith("_"))
  .map(f => f.replace(/\.jsx$/, "")).filter(id => !ONLY || ONLY.split(",").includes(id));

// 只保留可 JSON 序列化的数据（函数、React 元素等丢弃）
const plain = v => JSON.parse(JSON.stringify(v ?? null, (k, x) => (typeof x === "function" || (x && x.$$typeof) ? undefined : x)));

// 构建时提取各章数据
// 书目录下放一个指向框架 node_modules 的软链接（已被 .gitignore 忽略），使章节文件里的 react 等裸导入
// 能按 Node 规则解析——SSR 提取数据时由 Node 直接加载这些（CommonJS）依赖。
function linkNodeModules() {
  const link = path.join(BOOK, "node_modules");
  try { fs.lstatSync(link); } catch { fs.symlinkSync(path.join(APP, "node_modules"), link, "dir"); }
}

async function extractData(ids) {
  linkNodeModules();
  const server = await createServer({
    configFile: false, root: APP, logLevel: "error", appType: "custom",
    server: { middlewareMode: true, hmr: false, fs: { allow: [BOOK, APP] } },
    resolve: { alias: alias.filter(a => a.find === "@kit") }, plugins: [react(), bookPlugin({ book: null, data: {}, ids, page: null })],
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const book = (await server.ssrLoadModule(path.join(BOOK, "book.js"))).default;
  const data = {};
  for (const id of ids) {
    try {
      const m = await server.ssrLoadModule(path.join(CHAPTERS, id + ".jsx"));
      data[id] = Object.fromEntries(DATA_KEYS.filter(k => m[k] !== undefined).map(k => [k, plain(m[k])]));
    } catch (e) {
      console.warn(`[book] 提取 ${id} 的数据失败（页面仍会构建）：${e.message.split("\n")[0]}`);
      data[id] = {};
    }
  }
  await server.close();
  return { book: plain(book), data };
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = s => String(s ?? "").replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
function html({ title, desc, page, lang = "zh-CN" }) {
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${desc ? `\n<meta name="description" content="${esc(strip(desc)).slice(0, 300)}">` : ""}</head>
<body><div id="root"></div><script type="module">import "virtual:page/${page ?? ""}";</script></body>
</html>
`;
}

// virtual:book —— { book, available, data }；virtual:page/<id> —— 该页入口（书架为 virtual:page/）
function bookPlugin(ctx) {
  return {
    name: "book",
    resolveId: s => (s === "virtual:book" || s.startsWith("virtual:page/") ? "\0" + s : null),
    load(s) {
      if (s === "\0virtual:book") {
        const bookImport = `export { default as book } from ${JSON.stringify(path.join(BOOK, "book.js"))};`;
        return `${bookImport}\nexport const available = ${JSON.stringify(ctx.ids)};\nexport const data = ${JSON.stringify(ctx.data)};`;
      }
      if (s.startsWith("\0virtual:page/")) {
        const id = s.slice("\0virtual:page/".length);
        const main = JSON.stringify(path.join(APP, "src/main.jsx"));
        return id
          ? `import { mount } from ${main};\nimport * as mod from ${JSON.stringify(path.join(CHAPTERS, id + ".jsx"))};\nmount(${JSON.stringify(id)}, mod);`
          : `import { mount } from ${main};\nmount(null, null);`;
      }
    },
  };
}

// GitHub Pages：禁用 Jekyll（否则以下划线开头的文件会被忽略）
const nojekyll = () => ({ name: "nojekyll", generateBundle() { this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" }); } });

// book.json：书的基本信息与章节清单（供书库首页等外部页面读取）
const bookJson = (book, data, ids) => ({
  name: "book-json",
  generateBundle() {
    const info = {
      slug: path.basename(BOOK), kind: book.statements ? "proof" : (book.kind || "explainer"),
      title: book.title, title_en: book.title_en, author: book.author, subtitle: book.subtitle, intro: book.intro,
      parts: book.parts || [],
      chapters: (book.chapters || []).map(c => ({ id: c.id, no: c.no, title_zh: c.title_zh, title_en: c.title_en, part: c.part,
        ready: ids.includes(c.id), one_liner: data[c.id]?.meta?.one_liner || null })),
      connections: ids.includes("connections"),
      built: new Date().toISOString(),
    };
    this.emitFile({ type: "asset", fileName: "book.json", source: JSON.stringify(info, null, 1) });
  },
});

export default defineConfig(async () => {
  const ids = chapterIds();
  const { book, data } = await extractData(ids);
  // 生成各页 HTML（Vite 多页入口）
  fs.rmSync(GEN, { recursive: true, force: true });
  fs.mkdirSync(GEN, { recursive: true });
  const input = {};
  fs.writeFileSync(path.join(GEN, "index.html"), html({ title: `${book.title} · 图书讲透`, desc: book.intro, page: "" }));
  input.index = path.join(GEN, "index.html");
  for (const id of ids) {
    const c = book.chapters.find(x => x.id === id), m = data[id]?.meta || {};
    const title = id === "connections" ? `全书脉络 · ${book.title}` : `${m.title_zh || c?.title_zh || id} · ${book.title}`;
    fs.mkdirSync(path.join(GEN, id), { recursive: true });
    fs.writeFileSync(path.join(GEN, id, "index.html"), html({ title, desc: m.one_liner || c?.title_en, page: id }));
    input[id] = path.join(GEN, id, "index.html");
  }
  return {
    root: GEN,
    base: "./",
    publicDir: fs.existsSync(path.join(BOOK, "public")) ? path.join(BOOK, "public") : false,   // 书的静态资源（如 figures/）
    plugins: [react(), bookPlugin({ book, data, ids }), nojekyll(), bookJson(book, data, ids)],
    resolve: { alias },
    server: { fs: { allow: [BOOK, APP] } },
    build: { outDir: process.env.OUT || path.join(BOOK, "dist"), emptyOutDir: true, rollupOptions: { input } },
  };
});

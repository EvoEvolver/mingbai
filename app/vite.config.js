import { defineConfig, createServer } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { MESSAGES, langOf } from "./src/kit/i18n/messages.js";

// Multi-page static site (GitHub Pages friendly):
//   <outDir>/index.html            shelf
//   <outDir>/<chapterId>/index.html   one real page per chapter (loads only that chapter's code; shared dependencies are split into common chunks automatically)
// All links and assets use relative paths, so the site can be deployed under any subpath (e.g. user.github.io/repo/).
//
// Env vars: BOOK=<book dir> (required); ONLY=ch03 or ch01,ch02 builds only those chapters; OUT=<output dir> (default <book>/dist).
//
// Cross-chapter data (each chapter's meta / notation / concepts / groups / relations / links) is extracted at build time by loading chapter modules with SSR,
// and injected into every page as the data of virtual:book. The shelf, cross-chapter connections, cross-chapter symbols, and whole-book overview page all rely on it, with no need to load other chapters' code.
const APP = import.meta.dirname;
if (!process.env.BOOK) throw new Error("Set the book directory with the BOOK env var, e.g. BOOK=/path/to/my-book npx vite build");
const BOOK = path.resolve(process.env.BOOK);
const ONLY = process.env.ONLY;
const CHAPTERS = path.join(BOOK, "chapters");
const GEN = path.join(APP, ".pages", path.basename(BOOK) + (ONLY ? "-" + ONLY.replace(/,/g, "_") : ""));
const DATA_KEYS = ["meta", "notation", "groups", "concepts", "relations", "links"];

const alias = [
  { find: "@kit", replacement: path.join(APP, "src/kit") },
  // Chapter files live in the book directory (outside the framework), so always resolve react from the framework's node_modules
  { find: /^(react|react-dom)(\/.*)?$/, replacement: path.join(APP, "node_modules/$1$2") },
];

const chapterIds = () => fs.readdirSync(CHAPTERS).filter(f => /\.jsx$/.test(f) && !f.startsWith("_"))
  .map(f => f.replace(/\.jsx$/, "")).filter(id => !ONLY || ONLY.split(",").includes(id));

// Keep only JSON-serializable data (functions, React elements, etc. are dropped)
const plain = v => JSON.parse(JSON.stringify(v ?? null, (k, x) => (typeof x === "function" || (x && x.$$typeof) ? undefined : x)));

// Extract each chapter's data at build time
// Put a symlink to the framework's node_modules in the book directory (ignored via .gitignore), so bare imports like react in chapter files
// resolve by Node's rules: during SSR data extraction, Node loads these (CommonJS) dependencies directly.
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
      console.warn(`[book] Failed to extract data for ${id} (the page will still be built): ${e.message.split("\n")[0]}`);
      data[id] = {};
    }
  }
  await server.close();
  return { book: plain(book), data, anchors: anchorMap(book, ids) };
}

// With split chapters (e.g. ch07 / ch07b both belong to chapter 7), inferring the chapter from a number goes wrong: scan each chapter's source for <Eq n> <Figure n> <Sec n> <Sub n>,
// and record the numbers whose "actual chapter ≠ chapter inferred from the number", for chapterOfNum(n, kind) to use first.
function anchorMap(book, ids) {
  const KIND = { Eq: "eq", Figure: "fig", Sec: "sec", Sub: "sec" }, out = {};
  const guess = n => { const h = String(n).split(".")[0]; return /^\d+$/.test(h) ? book.chapters.find(c => String(c.no) === h)?.id : book.chapters.find(c => c.id === "app" + h)?.id; };
  for (const id of ids) {
    let src = "";
    try { for (const f of fs.readdirSync(CHAPTERS)) if (f === id + ".jsx" || (f.startsWith(`_${id}_`) && f.endsWith(".jsx"))) src += fs.readFileSync(path.join(CHAPTERS, f), "utf8"); } catch { continue; }
    for (const m of src.matchAll(/<(Eq|Figure|Sec|Sub)\b[^>]*?\bn="([^"]+)"/g)) if (guess(m[2]) !== id) out[`${KIND[m[1]]}:${m[2]}`] = id;
  }
  return out;
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = s => String(s ?? "").replace(/\$([^$]*)\$/g, "$1").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "");
function html({ title, desc, page, lang }) {
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${desc ? `\n<meta name="description" content="${esc(strip(desc)).slice(0, 300)}">` : ""}</head>
<body><div id="root"></div><script type="module">import "virtual:page/${page ?? ""}";</script></body>
</html>
`;
}

// virtual:book — { book, available, data }; virtual:page/<id> — that page's entry (the shelf is virtual:page/)
function bookPlugin(ctx) {
  return {
    name: "book",
    resolveId: s => (s === "virtual:book" || s.startsWith("virtual:page/") ? "\0" + s : null),
    load(s) {
      if (s === "\0virtual:book") {
        const bookImport = `export { default as book } from ${JSON.stringify(path.join(BOOK, "book.js"))};`;
        return `${bookImport}\nexport const available = ${JSON.stringify(ctx.ids)};\nexport const data = ${JSON.stringify(ctx.data)};\nexport const anchors = ${JSON.stringify(ctx.anchors || {})};`;
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

// GitHub Pages: disable Jekyll (otherwise files starting with an underscore are ignored)
const nojekyll = () => ({ name: "nojekyll", generateBundle() { this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" }); } });

// book.json: basic book info and chapter list (read by external pages such as the library home page)
const bookJson = (book, data, ids) => ({
  name: "book-json",
  generateBundle() {
    const info = {
      slug: path.basename(BOOK), lang: langOf(book), kind: book.statements ? "proof" : (book.kind || "explainer"),
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
  const { book, data, anchors } = await extractData(ids);
  // Generate each page's HTML (Vite multi-page entries)
  fs.rmSync(GEN, { recursive: true, force: true });
  fs.mkdirSync(GEN, { recursive: true });
  const input = {};
  const ui = MESSAGES[langOf(book)], lang = ui["html.lang"];
  fs.writeFileSync(path.join(GEN, "index.html"), html({ title: `${book.title} · ${ui["site.brand"]}`, desc: book.intro, page: "", lang }));
  input.index = path.join(GEN, "index.html");
  for (const id of ids) {
    const c = book.chapters.find(x => x.id === id), m = data[id]?.meta || {};
    const title = id === "connections" ? `${ui["nav.connections"]} · ${book.title}` : `${m.title_zh || m.title_en || c?.title_zh || c?.title_en || id} · ${book.title}`;
    fs.mkdirSync(path.join(GEN, id), { recursive: true });
    fs.writeFileSync(path.join(GEN, id, "index.html"), html({ title, desc: m.one_liner || c?.title_en, page: id, lang }));
    input[id] = path.join(GEN, id, "index.html");
  }
  return {
    root: GEN,
    base: "./",
    publicDir: fs.existsSync(path.join(BOOK, "public")) ? path.join(BOOK, "public") : false,   // the book's static assets (e.g. figures/)
    plugins: [react(), bookPlugin({ book, data, ids, anchors }), nojekyll(), bookJson(book, data, ids)],
    resolve: { alias },
    server: { fs: { allow: [BOOK, APP] } },
    build: { outDir: process.env.OUT || path.join(BOOK, "dist"), emptyOutDir: true, rollupOptions: { input } },
  };
});

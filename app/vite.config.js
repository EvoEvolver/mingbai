import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// BOOK=<书目录>（默认 ../../oot）。ONLY=ch03 或 ONLY=ch01,ch02 时只打包这些章（并行开发时互不影响）。
const BOOK = path.resolve(process.env.BOOK || path.join(import.meta.dirname, "../../oot"));
const ONLY = process.env.ONLY;

// virtual:book —— 导出 book 清单与各章节模块（book/chapters/*.jsx 自动发现）
function bookPlugin() {
  const id = "virtual:book", rid = "\0" + id;
  return {
    name: "book",
    resolveId: s => (s === id ? rid : null),
    load(s) {
      if (s !== rid) return;
      const dir = path.join(BOOK, "chapters");
      const files = fs.readdirSync(dir).filter(f => /\.jsx$/.test(f) && !f.startsWith("_"))
        .filter(f => !ONLY || ONLY.split(",").includes(f.replace(/\.jsx$/, "")));
      const imports = files.map((f, i) => `import * as m${i} from ${JSON.stringify(path.join(dir, f))};`).join("\n");
      const map = files.map((f, i) => `${JSON.stringify(f.replace(/\.jsx$/, ""))}: m${i}`).join(",");
      return `${imports}\nexport { default as book } from ${JSON.stringify(path.join(BOOK, "book.js"))};\nexport const modules = {${map}};`;
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: fs.existsSync(path.join(BOOK, "public")) ? path.join(BOOK, "public") : false,   // 书的静态资源（如 figures/）
  plugins: [react(), bookPlugin()],
  resolve: {
    alias: [
      { find: "@kit", replacement: path.join(import.meta.dirname, "src/kit") },
      // 章节文件位于书目录（框架之外），统一从框架的 node_modules 解析 react
      { find: /^(react|react-dom)(\/.*)?$/, replacement: path.join(import.meta.dirname, "node_modules/$1$2") },
    ],
  },
  server: { fs: { allow: [BOOK, import.meta.dirname] } },
  build: { outDir: process.env.OUT || path.join(BOOK, "dist"), emptyOutDir: true },
});

# 路由、构建与部署（GitHub Pages 友好）

## 站点结构：多页静态站点，按路径路由
每本书构建成一个纯静态目录（默认 `<书>/dist/`），不依赖服务器重写规则：

```
dist/
  index.html              书架
  ch02/index.html         每章一个真实页面（只加载本章代码 + 共享的框架块）
  connections/index.html  全书脉络页（若有）
  assets/…                JS/CSS/字体（全部用相对路径引用）
  figures/…               书的 public/ 静态资源
  .nojekyll               让 GitHub Pages 不忽略下划线开头的文件
```

- 页面地址：`<站点>/ch02/`；页内锚点用普通 hash：`<站点>/ch02/#eq-2.23`、`#sec-2.1`、`#fig-2.3`、`#ex-2.4`、`#thm-L2.1`。
- 所有链接与资源都是相对路径，因此可以部署在任意子路径（如 `https://<user>.github.io/<repo>/cosmo/`）。
- 旧式哈希链接 `#/ch02/eq-2.23` 仍可用：打开时自动跳转到 `ch02/#eq-2.23`；内容里残留的 `href="#/…"` 会被自动改写。
- 每页的 `<title>` 与 `<meta name="description">` 在构建时由章节的 `meta.title_zh` / `meta.one_liner` 生成。

## 跨章数据
构建时（`vite.config.js`）用 Vite SSR 加载每个章节模块，提取其中可 JSON 序列化的导出
`meta / notation / groups / concepts / relations / links`，作为 `virtual:book` 的 `data` 注入每个页面。
书架的一句话简介、跨章联系、跨章概念卡、跨章符号词典、全书脉络页都由它提供，不需要加载其他章节的代码。
因此：**这些导出必须是纯数据**（字符串/数字/数组/对象）；函数和 JSX 会被丢弃。

为了让书目录里的章节能解析 `react` 等依赖，构建时会在书目录下自动创建软链接 `node_modules → framework/app/node_modules`（已被 .gitignore 忽略）。

## 站内链接（写章节时）
- 用 `pageUrl(id, anchor)`（`import { pageUrl } from "@kit"`）：`pageUrl("ch03")`、`pageUrl("ch03", "eq-3.12")`、`pageUrl(null)`（书架）。同页时返回 `#anchor`。
- 文本里的引用照旧用 `\eqref{3.12}`、`\figref{}`、`\secref{}`、`\exref{}`、`\sref{}`，框架会生成正确的跨页链接。
- 当前页 id：`currentPage()`；某章是否存在：`hasChapter(id)`；跳转：`go(id, anchor)`。

## 构建
```bash
export PATH=$HOME/.local/node/bin:$PATH
cd framework/app
BOOK=$PWD/../../cosmo npx vite build                      # → cosmo/dist
BOOK=… OUT=/tmp/site npx vite build                       # 指定输出目录
ONLY=ch02,ch03 BOOK=… npx vite build                      # 只构建部分章节（书架只列出这些）
../build-all.sh                                           # 全部书
```

## 部署到 GitHub Pages
任选其一：

1. **gh-pages 分支**：把一本或多本书的 `dist/` 放进站点目录后推到 `gh-pages` 分支，仓库 Settings → Pages 选该分支。
   多本书可放在子目录：`site/cosmo/`、`site/oot/`……（相对路径保证各自独立可用），再在 `site/index.html` 写一个总目录页。
2. **GitHub Actions**：在 workflow 里 `npm ci`（framework/app）→ 对每本书 `BOOK=… OUT=site/<书> npx vite build` → `actions/upload-pages-artifact` 上传 `site/` → `actions/deploy-pages`。
   注意：原书文字层 `text/` 与原书插图 `public/figures/` 不在仓库中（版权），CI 构建出的数理书将缺插图；公开部署前请确认版权许可。

本地/treer 部署：`/usr/bin/python3 -I framework/serve.py <书目录> <端口>`（直接提供 `<书>/dist`，目录自动对应 `index.html`）。

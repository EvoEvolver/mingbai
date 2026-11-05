# 做一本新书

框架：本仓库（React + Vite，组件库在 `app/src/kit`）。完整样例：福柯《词与物》，见 mingbai-notes 仓库的 [`oot/`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot)。

## 规则
- **书的代码放在书目录里，不要修改框架。** 书需要的特殊组件放在自己书目录的 `chapters/_<id>_*.jsx`。
- 版权约束同 `spec/KIT.md`：不大段转写原文；每章原文引用 ≤4 条、每条英文 ≤25 词。

## 步骤
1. **建书目录** `<书目录>/`，内含：
   - `book.js`：照抄 [`oot/book.js`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/book.js) 的格式（title、title_en、author、subtitle、intro、parts、chapters[{id,no,title_zh,title_en,part,text}]）。英文书加 `lang: "en"` 并只写 `title_en`（见 KIT.md「界面语言」）。章节 id 用 `ch00`（前言/引言，如有）、`ch01`…；parts 按原书结构划分。
   - `text/`：每章一个纯文本文件。epub 用 `python3 -I extract.py <xhtml> <out.txt>`（先 unzip 到 `<slug>/src/`）；PDF 用 `pdftotext -layout -f <起页> -l <止页>`，先用目录页确定每章页码范围。抽出后抽查确认章节边界正确。
   - `chapters/`：章节 JSX。
2. **每章一个独立 subagent**（并行），给每个 subagent 的说明要包括：
   - 先完整阅读 `spec/KIT.md` 和范例 [`oot/chapters/ch02.jsx`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/chapters/ch02.jsx)、`_ch02_similitudes.jsx`；
   - 自检命令要带书目录：`spec/check.sh <id> <书目录>`，截图位于 `/tmp/check-<slug>-<id>/`；
   - 章节 id、标题、原文文件、小节结构，以及你对本章"专属互动图解"的建议（挑本章最核心、最适合可视化的结构）；
   - KIT.md 里"知识型"等说法是福柯语境的举例，按本书的思想脉络改写（CompareTable 选本书真正的对立面）。
3. 所有章节完成后，自己整书构建并检查：
   ```bash
   cd app && BOOK=<书目录> npx vite build   # 输出到 <slug>/dist
   ```
   用 `node tools/pw/shot.mjs <url> <out.png>` 抽查几章（先 `python3 -m http.server <port> -d <slug>/dist &` 起临时服务，用完 kill 掉）。
4. **（可选，推荐）全书脉络**：再开一个 subagent 写 `chapters/connections.jsx`：`export const links=[{from:"ch02:<概念id>",to:"ch05:<概念id>",label,note}]`（各章节页会自动出现"跨章联系"区块），`export default` 用 `BookPage` 组织页面（`<C id="chNN:id">` 跨章引用，`<ConceptMap edges={links}>` 画跨章关系图）。参考 `app/src/kit/layout.jsx` 里的 `BookPage`。
5. **发布到书库**：把书目录名加进 `<书库目录>/library/books.txt`（决定在书库中的位置），然后运行
   ```bash
   build-library.sh --build <slug>   # 只重建这本书；书库会重新组装（其他书用现有构建产物）
   ```
6. 交付报告：网址、章节列表、各章专属图解、存疑之处。


## 路由与部署
站点为多页静态站点（每章 `<id>/index.html`），可直接部署到 GitHub Pages；见 `spec/DEPLOY.md`。

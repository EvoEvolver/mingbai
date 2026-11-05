# 用"图书讲明白"框架做一本新书（给负责整本书的 agent）

框架：`/home/zijian/books/framework`（React + Vite，组件库在 `app/src/kit`）。已上线的完整样例：福柯《词与物》`/home/zijian/books/oot/`。

## 规则
- **不要修改 `framework/` 和 `oot/`**（框架由别的 agent 维护，正在并行使用）。你的书需要的特殊组件，放在自己书目录的 `chapters/_<id>_*.jsx`。如果确实发现框架 bug，在交付报告里说明。
- 版权约束同 `spec/KIT.md`：不大段转写原文；每章原文引用 ≤4 条、每条英文 ≤25 词。
- Node 在 `~/.local/node/bin`（需要 `export PATH=$HOME/.local/node/bin:$PATH`）。

## 步骤
1. **建书目录** `/home/zijian/books/<slug>/`，内含：
   - `book.js`：照抄 `oot/book.js` 的格式（title、title_en、author、subtitle、intro、parts、chapters[{id,no,title_zh,title_en,part,text}]）。英文书加 `lang: "en"` 并只写 `title_en`（见 KIT.md「界面语言」）。章节 id 用 `ch00`（前言/引言，如有）、`ch01`…；parts 按原书结构划分。
   - `text/`：每章一个纯文本文件。epub 用 `python3 -I /home/zijian/books/framework/extract.py <xhtml> <out.txt>`（先 unzip 到 `<slug>/src/`）；PDF 用 `pdftotext -layout -f <起页> -l <止页>`，先用目录页确定每章页码范围。抽出后抽查确认章节边界正确。
   - `chapters/`：章节 JSX。
2. **每章一个独立 subagent**（并行），给每个 subagent 的说明要包括：
   - 先完整阅读 `/home/zijian/books/framework/spec/KIT.md` 和范例 `/home/zijian/books/oot/chapters/ch02.jsx`、`_ch02_similitudes.jsx`；
   - **注意 KIT.md 中的路径是《词与物》的**：对它来说书目录是 `/home/zijian/books/<slug>`，原文在 `<slug>/text/…`，输出写到 `<slug>/chapters/<id>.jsx`；
   - 自检命令要带书目录：`/home/zijian/books/framework/spec/check.sh <id> /home/zijian/books/<slug>`，截图位于 `/tmp/check-<slug>-<id>/`；
   - 章节 id、标题、原文文件、小节结构，以及你对本章"专属互动图解"的建议（挑本章最核心、最适合可视化的结构）；
   - KIT.md 里"知识型"等说法是福柯语境的举例，按本书的思想脉络改写（CompareTable 选本书真正的对立面）。
3. 所有章节完成后，自己整书构建并检查：
   ```bash
   cd /home/zijian/books/framework/app && BOOK=/home/zijian/books/<slug> npx vite build   # 输出到 <slug>/dist
   ```
   用 `node /home/zijian/books/framework/tools/pw/shot.mjs <url> <out.png>` 抽查几章（先 `python3 -m http.server <port> -d <slug>/dist &` 起临时服务，用完 kill 掉）。
4. **（可选，推荐）全书脉络**：再开一个 subagent 写 `chapters/connections.jsx`：`export const links=[{from:"ch02:<概念id>",to:"ch05:<概念id>",label,note}]`（各章节页会自动出现"跨章联系"区块），`export default` 用 `BookPage` 组织页面（`<C id="chNN:id">` 跨章引用，`<ConceptMap edges={links}>` 画跨章关系图）。参考 `framework/app/src/kit/layout.jsx` 里的 `BookPage`。
5. **发布到书库**：把书目录名加进 `/home/zijian/books/library/books.txt`（决定在书库中的位置），然后运行
   ```bash
   /home/zijian/books/framework/build-library.sh --build <slug>   # 只重建这本书；书库会重新组装（其他书用现有构建产物）
   ```
   书库由 treer app `book-library` 提供服务，无需为单本书新建 app。书的地址是 `<书库>/<slug>/`。
6. 交付报告：网址、章节列表、各章专属图解、存疑之处。


## 路由与部署
站点为多页静态站点（每章 `<id>/index.html`），可直接部署到 GitHub Pages；见 `framework/spec/DEPLOY.md`。

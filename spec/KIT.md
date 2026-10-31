# 图书讲透 · 章节编写指南（给写章节的 agent）

## 目标
把原著的**一章**写成一个生动、好懂的 React 页面。目标读者：聪明但没读过原著的中文读者。
原著常见问题是**举例过多、概念晦涩**，你的任务：
- **抽离核心概念**，用大白话 + 现代类比讲透；
- **压缩例子**：指出一串例子其实在证明同一件事，每个概念只保留最有代表性的 1 个书中例子；
- **串起论证主线**：让读者看到本章一步步在论证什么；
- **至少做 1 个本章专属的互动图解**（这是页面最出彩的地方）：找出本章最核心、最适合可视化的结构（一个模型、一张表、一个过程、一个转变），做成可点、可切换、会动的 SVG/HTML 组件。
- 忠实原著，不臆造。拿不准的地方在交付回复里列出。

**版权约束**：不要大段转写原文。原文引用最多 4 条，每条英文 ≤ 25 词；其余全部用自己的中文话语改写。

所有面向读者的文字用中文，术语保留原文（如 *mathesis*）。

## 文件
- 原文：`/home/zijian/books/oot/text/<文件>.txt`（纯文本，含小节标题；文末注释可忽略）。必须分段读完全文。
- 你写：`/home/zijian/books/oot/chapters/<id>.jsx`（章节主文件），可加辅助文件 `/home/zijian/books/oot/chapters/_<id>_*.jsx`（下划线开头的文件不会被当成章节）。
- **只能写你自己章节的文件**。不要改 `framework/`、`book.js` 或其他章节。缺通用组件就在自己的 `_<id>_*.jsx` 里写。
- **范例（必读，对齐结构与质量）**：`/home/zijian/books/oot/chapters/ch02.jsx` 和 `_ch02_similitudes.jsx`。
- 组件库源码：`/home/zijian/books/framework/app/src/kit/`（index.js 列出全部导出）。样式变量见 `kit/style.css`（`--paper --ink --muted --line --accent --gold --blue --green --violet --card --shadow --serif --sans`）。

## 章节文件约定
```jsx
import { ChapterPage, Block, ... } from "@kit";
export const meta = { id:"ch03", no:3, title_zh, title_en, era, one_liner(≤45字), big_question, why_it_matters(2-3句), original_words, read_minutes };
export const groups = [{id,label}];            // 2-5 个概念分组（筛选与配色）
export const concepts = [{ id(snake_case), name_zh, name_en, icon(单个emoji), section_id, group,
  plain(≤35字大白话), explain(2-3段,\n\n分隔,150-300字), analogy(现代类比60-120字),
  book_example:{what, point}, misconception }];   // 8-14 个
export const relations = [{from, to, label(≤8字)}];   // 10-18 条
export default function Chapter() { return <ChapterPage meta={meta} groups={groups} concepts={concepts} relations={relations}> ...区块... </ChapterPage>; }
```
`meta / groups / concepts / relations` **必须 export**（全书脉络页会跨章引用它们）。

## 组件（from "@kit"）
外壳与区块
- `<ChapterPage meta groups concepts relations>` 自动渲染 Hero（标题、一句话、大问题）、进度条、侧边目录、上一章/下一章导航。
- `<Block id toc kicker title lead>` 一个区块；有 `toc` 才进侧边目录。
- `<C id="concept_id">文字</C>` 正文里的行内概念链接，点击弹出概念卡。`<ConceptChip id>` 胶囊版。

标准区块（推荐顺序，可增删调整；不适合本章的就不要硬塞）
- `<Hook title>文字</Hook>` 现代情境开场（120-200 字）
- `<SectionCards sections=[{id,no,title_zh,title_en,gist,summary(80-150字),concept_ids}]>` 与原著小节一一对应
- `<ArgumentFlow steps=[{claim,detail}]>` 6-10 步论证主线
- **本章专属图解**（自己写）
- `<ConceptGrid/>` 概念卡片（读 ChapterPage 数据）
- `<ConceptMap height?/>` 概念关系图
- `<ExampleCompression items=[{examples:[{tag, detail}...], says}]>` 3-5 组，每组 3-6 个例子。**每个例子都要写 `detail`**：`tag` 是 ≤12 字的短标签，`detail` 用 2-4 句（60-150 字）讲清原著里这个例子具体是什么、作者怎么用它、说明了什么——读者点标签就能展开，不能只给一个看不懂的名字。`says` 是这一串例子共同证明的一句话。（旧写法 `examples:[字符串]` 仍兼容，但不推荐。）
- `<DragSort categories=[{id,label}] items=[{text,answer,why}]>` 只在本章有天然分类结构时用，8-12 项
- `<CompareTable left right rows=[{aspect,left,right}]>` 5-7 行，通常是本章知识型 vs 前一个知识型 / vs 今天的直觉
- `<QuoteCarousel quotes=[{en,zh,meaning}]>` ≤4 条，en ≤25 词
- `<Quiz questions=[{q,options[4],answer,why}]>` 5-6 题，考理解不考记忆，正确答案位置打散
- `<Takeaways items>` 3-5 条 + `<Bridge>` 与下一章的衔接 60-120 字（最后一章写全书收束；前言写如何进入第 1 章）
- `<Glossary terms=[{term,zh,def}]>`

自定义图解的基础件
- `<Callout tone="info|warn|key|quote" title>`、`<Card>`、`<Grid min>`、`<Reveal>`
- `<Tabs tabs=[{label,content}]>`
- `<StepThrough steps=[{label,content}] render={i => <svg>…</svg>}>` 分步讲解，图随步骤变化（非常适合讲过程/推导）
- `<Toggle options={["古典","现代"]}>{v => ...}</Toggle>` 两态/多态切换对比
- `<Timeline events=[{year,label,note}]>`
- `useChapter()` 取 `{byId, open(id), color(groupId)}`；`useReveal()`；`useToast()`
- 也可以直接写 SVG + `useState`（见 `_ch02_similitudes.jsx`，SVG 用 viewBox 自适应，SMIL `<animate>` 做动效）。

## 链接与路由
站点是多页静态站点：每章一个页面 `<id>/`，页内锚点用普通 hash（如 `ch02/#eq-2.23`）。站内链接**不要手写 `#/…`**，
用 `pageUrl(id, anchor)`（from "@kit"；`pageUrl(null)` 为书架）。章节导出的 `meta / concepts / groups / relations / notation / links`
会在构建时被提取为全书索引，**必须是纯数据**（不要放函数或 JSX）。详见 `framework/spec/DEPLOY.md`。

## 自检（必须做）
```bash
/home/zijian/books/framework/spec/check.sh <id>
```
它会单独构建你的章节、截图并输出 JSON 报告（区块列表、控制台错误）。要求：
1. 构建成功、`errors` 为空；
2. 用 Read 工具查看截图 `/tmp/check-<id>/shot.png`（长图）与 `shot-modal.png`，确认排版正常、专属图解渲染正确。专属图解可单独截图：
   先 `python3 -m http.server <port> -d /tmp/check-<id>/site &`，再 `PATH=$HOME/.local/node/bin:$PATH node /home/zijian/books/framework/tools/pw/el.mjs "http://localhost:<port>/<id>/" "#b-<blockid>" /tmp/check-<id>/el.png`，用完 kill 掉服务器。
3. 有问题就改，直到满意。

## 交付回复（简短）
文件列表；概念 id 列表；专属图解做了什么；原文理解上拿不准的地方。

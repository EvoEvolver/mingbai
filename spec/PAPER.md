# 论文导读（PAPER）

论文与教科书的读法不同：读者要的是**这篇论文补上了什么缺口、为什么值得做、怎么做的、做成了没有**。
论文页沿用数理组件（`Eq`、符号词典、`Plot`、`Derivation`、`Box`…，见 TEXTBOOK.md），叙事骨架换成下面的组件（`@kit` 导出，源码 `kit/paper/paper.jsx`）。

## 书目配置
一篇论文就是一本"书"：`<目录>/book.js` 设 `kind: "paper"`，并给出 `paper: { title, authors, venue, year, arxiv, doi, code, license }`。
页面通常 2–3 个：`paper`（速读 + 完整导读，必有）；需要时再加 `method`（方法细节/推导）、`results`（实验细节）等深读页。

## 页面骨架（paper 页）
```jsx
<PaperPage meta={meta} notation={notation} concepts={concepts}>
  <PaperSec role="background">…读懂本文需要的最少背景…</PaperSec>
  <PaperSec role="gap">        <GapMap rows criteria gap/> </PaperSec>
  <PaperSec role="motivation"> <Stakes chain payoff/> </PaperSec>
  <PaperSec role="solution">   <KeyIdea/> <Pipeline steps/> …公式与交互图… </PaperSec>
  <PaperSec role="result">     <Headline/> <ClaimBoard/> <Claim>…证据…</Claim> </PaperSec>
  <PaperSec role="limits">     <Limits/> </PaperSec>
  <PaperSec role="editor">     <EditorView/> <ReadingGuide/> <Quiz/> </PaperSec>
</PaperPage>
```
meta 额外字段：`paper`（可省，取 book.paper）、`tldr`（一句话）、`gmsr: { gap, motivation, solution, result }`（四格速读，各 1–2 句，显示在页首，点击跳到对应 `PaperSec`）。

## 组件
| 组件 | 作用 |
|---|---|
| `PaperSec role` | 按论证角色着色的大节：gap / motivation / solution / result / limits / background / editor；每种角色第一节自动获得锚点 `role-<role>` |
| `GMSR` | 四格速读（PaperPage 自动渲染 meta.gmsr） |
| `GapMap rows criteria? gap` | 已有方法 × 能/不能做到（criteria + marks: true/false/"partial" 画成对照表；否则逐行 does/misses）；`ours: true` 标本文；`gap` 为缺口陈述 |
| `Stakes chain payoff` | 动机因果链：`[{if, then}]` 或字符串数组 |
| `KeyIdea analogy` | 全文最该记住的一招 |
| `Pipeline steps` | 方法流程：`[{title, what, why, out, detail}]`，点击展开 detail（可放 Eq、交互图） |
| `Headline items` | 关键数字 `[{value, label, note}]` |
| `ClaimBoard claims` / `Claim id claim strength caveat where` | 主张 ↔ 证据。strength 为**编者**对证据强度的判断：strong / moderate / weak；caveat 写清适用范围；where 指原文图表/节 |
| `Limits limits open` | 局限（作者承认的 + 编者看到的）与开放问题 |
| `EditorView strengths concerns questions` | 编者评注，页面上明确标注"不代表原作者观点" |
| `ReadingGuide rows` | 不同目的该读原文哪里、可以跳过哪里 |

## 写法要求
- **讲解自己写**：不逐句翻译、不改写原文段落；按"缺口 → 动机 → 方案 → 结果"重组。原文只作简短引语。
- **图自己画**：结果图用论文报告的数据（数值、趋势）或我们自己的数值实验重画为交互图；不裁剪原文插图。
- **主张要有证据**：每个 `Claim` 的证据指向原文具体图表/节，或我们的复现；证据强度如实标注，适用条件写进 caveat。
- **交互图优先演示核心机制**：读者能拖参数、看见方案为什么有效（必要时用缩小规模的可在浏览器里算的玩具版本，并说明与原文规模的差别）。
- 注明出处与许可（PaperCite 自动显示 `paper.license`）。
- 自检与教科书相同：`framework/spec/check.sh <页面id> <书目录>`（errors / texErrors / symMiss 为空），截图核对。

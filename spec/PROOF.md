# 定理–证明类文本组件（论文、数学书）

源自 ETH 论文书（`/home/zijian/books/eth`，完整范例），现已并入框架 `kit/math/proof.jsx`，从 `@kit` 导入。
数理通用组件（`TextbookPage / Sec / Sub / Eq / Tx / Box / Derivation / Roadmap / EqMap / Plot / ConceptGrid / Quiz …`）见 `TEXTBOOK.md`，照常使用。

```jsx
import { Stmt, SRef, Proof, Erratum, DepGraph, pageIds, StudyTable, RunCard, Check, MatrixView, Slider, Seg } from "@kit";
```

## 数据：陈述登记表（book.js 的 `statements`）
全书唯一数据源。在书目录里写一个登记表文件（如 `chapters/_stmts.js`，下划线开头不会被当成章节），由 `book.js` 引入：

```js
// book.js
import { STMTS } from "./chapters/_stmts.js";
export default { kind: "textbook", statements: STMTS, /* 可选 */ statementKinds: { … }, statementStatus: { … }, … };
```

每条陈述以 id 为键（如 `L2.1 P3.2 D4.2 T5.1`；未编号但在证明链上起作用的论断可用 `F:…`，外部引用 `X:…`，推论 `C:…`）：

| 字段 | 含义 |
|---|---|
| `kind` | `definition` `lemma` `proposition` `theorem` `corollary` `fact`（未编号论断） `cited`（外部引用） `claim` `conjecture` `example` |
| `n` | 原文编号（如 `"2.1"`、`"(2.2)"`） |
| `ch` | 所在章节页 id（用于跨页跳转） |
| `en` / `zh` | 英文 / 中文标题 |
| `page` | 原文页码 |
| `stmt` | 中文陈述（数学写 `$…$`，与原文逐字符一致） |
| `deps` | 证明直接用到的陈述 id 或公式编号 |
| `role` / `key` / `pitfall` | 在整体证明中的作用 / 关键一步 / 读者易卡住之处 |
| `status` / `statusNote` | `checked` 已逐步核对 · `filled` 原文略写、本站补全 · `note` 有注记；以及说明 |
| `eq` | 可选：对应的公式编号 |

**依赖图、悬停预览、"被用于"列表都由 `deps` 自动推出。** 类型名称与状态文字有默认值，可用 `statementKinds` / `statementStatus` 覆盖。

## 组件
| 组件 | 用途 | 接口 |
|---|---|---|
| `<Stmt id>` | 定理环境：编号标题 + 中文陈述 + 📒学习笔记（作用/依赖/被用于/关键一步/易卡点/核对说明）+ children（证明） | `notes={false}` 隐藏笔记；`toc={false}` 不进侧边目录；锚点 `<页>/#thm-<id>`（冒号换成 `_`） |
| `<SRef id>` | 陈述引用：悬停预览陈述全文，点击跳转（跨页亦可） | 可带 children 自定义文字 |
| `\sref{ID}` | 行内陈述引用 | 在**所有**支持公式的文本中可用（Tx/TxI、Sec 的 gist/why、Box、Derivation、Table、Hook、Bridge、Takeaways、Quiz、概念卡……） |
| `<Proof steps title collapsed source qed>` | 分步证明：每步 `{claim, tex?, why?, uses?:[陈述 id 或公式号], fill?:true}`；`fill` 标"本站补全"；可"逐步展开" | claim/why 支持 `$…$`、`\eqref{}`、`\sref{}` |
| `<DepGraph ids highlight focus>` | 证明依赖图（自上而下分层，被依赖者在上）；悬停高亮上下游，点击看陈述 | `ids` 缺省 = 全部；`pageIds("ch04")` = 该页陈述及其直接上下游 |
| `<StudyTable ids>` | 陈述一览：作用、依赖、核对状态 | |
| `<Erratum kind loc title>` | `kind="erratum"`：疑似笔误（给位置、原写法、推导、建议写法）；`kind="note"`（缺省）：注记 | children 为字符串时按 Tx 渲染 |
| `<RunCard title lead>` + `<Check ok label detail/>` | 浏览器内可运行示例的外壳与校验徽章 | 内部自由写 React |
| `<MatrixView M rowGroups colGroups title highlight rowLabels colLabels cell show>` | 小矩阵热图（有理数 `{n,d}` 或 number；蓝正红负；组分隔线） | |
| `<Slider label value min max step onChange fmt>`、`<Seg options value onChange>` | 示例控件 | `label` 按 TxI 渲染 |
| `statements()`、`stmtLabel(id)`、`anchorOf(id)` | 读取登记表、生成"引理 2.1"式标签、锚点 | |

书特有的工具（如 ETH 书的 `_rat.js` 有理数/积和式算法、`_ledger.jsx` 参数账本）仍放在各自书目录里。

## 写法约定
- 读者看到的数学一律写 `$…$`（含反斜杠的字符串用 ``R`…` ``），不要用 Unicode 拼公式。
- 每个编号陈述都写学习笔记（role / key / pitfall / status）；原文略写的步骤在 `<Proof>` 中补全并标 `fill`；笔误用 `<Erratum kind="erratum">` 就事论事地标出位置与推导。

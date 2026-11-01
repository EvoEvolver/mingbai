# 数理教科书 → HTML 编写规范（给写章节的 agent）

## 目标
把原书的**一章**做成可交互的 HTML 课本。读者是要真正学会这门课的学生（物理/天文研究生水平）。页面有**两层**，缺一不可：

**① 高层理解层（像人文导读那样，先给地图）** —— 让读者在进入推导前就知道：这一章要回答什么、分几步走、每步产出什么、核心概念是什么、关键方程之间谁推出谁。
**② 严谨正文层（真正的课本）** —— 原书每一节/小节（编号一致）、每个**带编号公式**、每张图、每道习题都在；推导不省略、公式逐字符核对。

### 讲解自己写，不翻译原书
正文是"老师讲课"式的重新讲解，不是译本：不要跟着原书的句子顺序逐句改写/翻译；每节按自己的讲课路线重组（问题/动机 → 核心想法 → 自己的推导路线 → 诠释与易错点），连接公式的文字全部自己写。公式与编号可以照原书转写；原书原话只作一两句的简短引语（加引号、注明出处）。自检：每节随机抽原书 3 段比对，页面上不应有逐句一一对应的段落。插图优先自绘（SVG/交互），不从 PDF 裁剪。

### 勘误：直接写对，不迁就原书
原书若有错（笔误、漏因子、符号错、编号引用错、单位错等），**正文直接写正确的版本**（公式编号不变；正文、say、符号词典、交互图同步改），旁边用 `<Box kind="warning" title={R`勘误：…`}>` 写明：原书印作什么、错在哪里、改正依据（推导、量纲或数值验证）。没有把握的保留原式，框标题写 `存疑：…`。交互图只画正确结果：不要画"原书误印"对照曲线，也不要提供复现误印的开关或乘数（原值写在勘误框文字里即可）。

### 公式可理解性是重中之重
- 页面上每个公式都可**点击放大**，放大窗口会自动列出「式中每个符号的含义」；公式里的每个符号都可**单独点击**查看定义。这一切依赖本章的**符号词典 `notation`** —— 它必须**覆盖本章公式中出现的全部符号**（自检的 `symMiss` 必须清零或仅剩有理由的例外）。
- 每个带编号的公式都要写 `say`：一句中文"读法"，说清这个式子在物理上说了什么（不是把符号念一遍）。例：`say="光子能量与标度因子成反比：宇宙膨胀一倍，光子能量减半。"`

### 写法：老师讲课，而不是翻译
- **不要逐句跟随原书**。每一节的结构是：**动机/图景**（为什么要做这一步、要得到什么）→ **核心推导**（关键步骤留在正文；冗长代数放进折叠的 `<Derivation collapsed>`）→ **结果解读**（物理意义、量级、极限情形）→ **小结过渡**。
- 原书的每个论证步骤、假设、近似条件、数值结论都要保留——但可以重组顺序、合并段落、加路标语（"我们现在要做的是……"、"注意这里用了……近似"）。
- 中文讲述，术语首次出现附英文（共形时间 conformal time）。
- **增强（只加不减）**：原书 "it is straightforward to show" 处用 `<Derivation>` 补全步骤；`<Box kind="physics">` 物理图像、`<Box kind="warning">` 易错点；**交互图**每章至少 3 个 `<Plot>`（浏览器内真算，数值与原书对照验证）。
- **版权**：不整段照搬原书英文；正文是你的中文讲述；习题用中文重述（数值、条件完全保留）。

## 页面结构（顺序）
```
TextbookPage（自动渲染：标题、one_liner、big_question、why_it_matters、overview、学习目标、前置知识）
  <Block toc="开场"><Hook title>现代/直观的情境引入</Hook></Block>
  <Block toc="路线图" title="本章路线图"><Roadmap steps=[每节一张：sec,title,gist,gives,next]/></Block>
  <Block toc="推导路线" title="关键方程如何推出"><EqMap edges=[…]/></Block>          ← 10–25 个节点，覆盖本章主干推导
  <Block toc="核心概念" title="核心概念"><ConceptGrid/></Block>                         ← 8–12 个物理概念卡
  <Sec n gist why gives> … 正文 … </Sec> × 原书各节                               ← 每个 Sec 都写 gist/why/gives
  <Block toc="小结"><Takeaways/> <Quiz/>（5–6 道概念自测） <Bridge>下一章</Bridge></Block>
  （习题 Sec）
  （自动：本章关键方程、符号表）
```
`Block / Hook / ConceptGrid / ConceptMap / Takeaways / Quiz / Bridge / C` 用法同人文版（见 KIT.md）；概念 `concepts` 的格式与人文版相同（id, name_zh, name_en, icon, group, plain, explain, analogy, book_example{what,point}, misconception），并通过 `TextbookPage` 的 `groups/concepts/relations` 传入。正文中可用 `<C id="…">` 链接概念卡（需在 JSX 中写，Tx 字符串内不支持）。

## 定理–证明类内容
论文、数学书等以定义/引理/定理/证明为骨架的文本，另用 `Stmt / SRef / \sref{} / Proof / DepGraph / Erratum / RunCard …`（陈述登记表放在 book.js 的 `statements`），见 `framework/spec/PROOF.md`，完整范例为 ETH 书 `/home/zijian/books/eth`。

## 链接
站内链接用 `pageUrl(id, anchor)`，引用用 `\eqref{}` 等记号；章节导出的 notation/concepts 等必须是纯数据。见 `DEPLOY.md`。

## 范例
已完成的试点章：`/home/zijian/books/cosmo/chapters/ch02.jsx` 及 `_ch02_*.jsx`。

## 材料（以本书 Modern Cosmology 为例，书目录 `/home/zijian/books/cosmo`）
- 文字层：`text/<id>.txt`，按 PDF 页分段，每页头部写明对应页面图像路径。**文字层中的数学是损坏的**，只用来读正文和定位公式编号。
- 页面图像：`src/pages/p-NNN.png`（150 dpi）。**所有公式都必须看页面图像转写**（用 Read 打开 PNG）。
- 插图：`public/figures/fig-<n>.png`，清单与原书图注在 `public/figures/figures.json`。
- 原书习题解答（部分）：附录 A，`text/appA.txt` 与对应页面图像。
- KaTeX 宏（书级，见 `book.js`）：`\H`=𝓗，`\Om \OL \Or \Ob \Oc \OK`，`\Mpc \hMpc \eV \dd \vk \vx \vp \phat`。

## 文件
- 写：`<BOOK>/chapters/<id>.jsx`（主文件）+ 按节拆分的 `_<id>_s1.jsx`…、`_<id>_plots.jsx`、`_<id>_overview.jsx`（路线图/概念等）。下划线开头的文件不会被当成章节。
- **只写自己章节的文件**；不改 `framework/`、`book.js`、其他章节。

## 组件（`import { … } from "@kit"`）
统一 `const R = String.raw;`，所有 LaTeX 用 ``R`...` `` 书写。
```jsx
export const meta = { id:"ch02", no:2, title_en, title_zh, pages:"21–56",
  one_liner: R`一句话说清本章`, big_question: R`本章真正要回答的问题`, why_it_matters: R`…`,
  overview: R`…`, objectives:[R`…`], prereq:[{ ch:"ch01", what:"…" }] };
export const notation = [ … ];   // 符号词典（见下）
export const groups = [ … ], concepts = [ … ], relations = [ … ];
export default function Chapter(){ return <TextbookPage meta={meta} notation={notation} groups={groups} concepts={concepts} relations={relations}> … </TextbookPage>; }
```
### 符号词典 `notation`（决定公式的可点击性）
`{ sym, name, en?, def, unit?, eq? }`
- `sym`：**只写符号本身**（含区分性下标），如 `R`H_0``、`R`T_\nu``、`R`\Omega_{\rm m}``、`R`\dot a``、`R`\Gamma^\mu{}_{\alpha\beta}``。不要写成 `H=\dot a/a` 或 `a(t)`（定义放进 def）。
- 匹配规则：公式中「基底+下标」先精确匹配（`T_\nu`），否则回退到只有基底的条目（`T`）。所以既要有通用条目（`T` 温度、`\rho` 能量密度、`\Omega` 密度参数），也要有重要的特定条目（`T_\nu`、`\rho_\gamma`、`\Omega_{\rm m}`、`H_0`）。下标/上标里的指标（μ、ν、i、j…）不参与匹配。
- 坐标、指标型符号也要收录：`t`、`x`（`x^\mu`/`x^i` 坐标）、`\boldsymbol{x}`、`p`、`\hat p`、`\eta`、`\lambda`（仿射参数）、`\delta_{ij}`（克罗内克 δ）、`g_{\mu\nu}`……
- 同一字母在本章有两种含义时：给条目写 `id` 字段，在公式中用 `\sym{<id>}{…}` 强制指定（本章短 id 即可，如 `\sym{Tmn}{T}`），或 `\nosym{…}` 取消标注（如纯指标字母）。
- 前面章节已定义的符号会自动可用（跨章共享），本章可覆盖。
- `def` 支持 `$…$` 与 `\eqref{}`；`eq` 为定义所在公式编号；`unit` 写量纲/单位（无量纲写"无量纲"）。

### 公式在哪里都能写（2026-10-30 起）
`Hook / Bridge / Takeaways / Quiz（题干、选项、解析）/ 概念卡全部字段 / Roadmap 标题 / Plot 的 caption / Block 的 title、lead / meta.one_liner 等 / book.js 的 intro` 都经过 `Rich` 渲染：字符串含 `$…$` 或 `\eqref{}` 等记号时按 KaTeX 渲染，否则原样输出（人文书不受影响）。**读者可见的数学一律写 `$…$`，不要用 Unicode 拼公式。** 书可以用 `extendInline(name, render)`（从 `@kit` 导入）注册自己的行内记号，例如论文书的 `\sref{L2.1}`，注册后在所有支持公式的文本中生效。

### 其他组件
- `<Sec n title zh gist why gives={["2.12"]}>`、`<Sub n title zh>`：编号与原书一致；gist=本节要点一句话，why=为什么需要这一步，gives=本节产出的关键方程。
- `<Tx>{R`…`}</Tx>`：空行分段；`$…$`、`$$…$$`、`\eqref{}`、`\figref{}`、`\secref{}`、`\exref{}`、`**粗体**`、`*强调*`。
- `<Eq n="2.23" say="…" keyEq title="…">{R`…`}</Eq>`：编号行间公式；**每个都写 say**；keyEq 每章 8–20 个，长章取上限（章末自动汇总；只有 keyEq 显示 title）。多个编号请拆成多个 `<Eq>`。
- `<Roadmap steps={[{ sec:"2.1", title:"膨胀的空间", gist:R`…`, gives:["2.12","2.28"], next:R`过渡：为什么接下来要…` }]}/>`
- `<EqMap edges={[{ from:"2.20", to:"2.28", label:"代入 FLRW" }]} labels={{ "2.20":"测地线方程" }}/>`：关键方程推导图（节点自动显示公式，点击放大）。
- `<EqChip n="2.23"/>`：小号可点击公式。
- 原书编号的例子：`<Box kind="example" n="5.12" title="…">`（显示「例 5.12」，锚点 `example-5.12`）。定理–证明型教科书（定义/定理/证明）另见 `PROOF.md`；书目录下的 `check.json` 可让 `tb_check` 核对陈述、例子与两类习题。
- `<Derivation title steps={[{tex, why}]} result collapsed?>`、`<Box kind="definition|result|note|example|physics|warning|aside|key|data" title>`、`<Figure n caption interactive={<Plot/>}>`、`<Plot …>`（数值工具 `num`）、`<Exercise n title level hint solution fromBook>`、`<Table>`、`<Details>`。

自绘插图用 `<Figure n caption illustration={<MyDiagram/>}>`：直接显示组件，不请求原书图片，保留原有图号和引用锚点。平面结构优先 SVG；需要旋转观察的曲面可在 `useEffect` 中按需加载 Three.js，提供无 WebGL 的替代图，并在卸载时释放资源。

## 内存纪律（多个 agent 并行时必须遵守）
构建、Playwright/Chromium 截图等重命令一律经 `/home/zijian/books/framework/tools/heavy.sh <命令…>` 运行（全局锁串行 + 内存检查；`check.sh` 已内置）。不要自行并行起多个构建或浏览器；临时 http 服务与浏览器用完即关；不要再派生子 agent。

## 工作流程
1. 通读本章文字层，列出节结构、公式编号、图、习题；先写**高层理解层**（one_liner、big_question、路线图、推导图、概念）——这会逼你先把本章的逻辑想清楚。
2. 逐节写正文：看页面图像转写公式，按"动机→推导→解读→过渡"组织讲解；每个 `<Eq>` 写 say；同步扩充 notation。
3. 补推导、物理图像、交互图；习题与解答（查附录 A）。
4. 自检（必须全部通过）：
   ```bash
   python3 -I /home/zijian/books/framework/spec/tb_check.py /home/zijian/books/cosmo <id>   # 完整性 + 结构检查 → OK
   /home/zijian/books/framework/spec/check.sh <id> /home/zijian/books/cosmo                   # errors / texErrors 为空；symMiss 清零（或逐项说明例外）
   ```
   用 Read 查看 `/tmp/check-cosmo-<id>/shot.png`；抽查 ≥15 个公式与页面图像逐字符核对；交互图截图并核对数值。
5. 交付报告：文件列表；tb_check 输出；symMiss 剩余项及理由；交互图清单及验证；补充推导；勘误（已改正）与存疑条目。

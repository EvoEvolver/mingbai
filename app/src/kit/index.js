// 图书讲透 · 组件库。章节文件统一从 "@kit" 引入。说明见 framework/spec/KIT.md
export { Paras, shuffle, PALETTE, useReveal, useToast, useChapter, ConceptChip, C } from "./core.jsx";
export { ChapterPage, BookPage, Block, Hero } from "./layout.jsx";
export { book, modules, allConcepts, chapterGroups, chapterLabel, crossLinks, pageUrl, currentPage, hasChapter, go } from "./book.jsx";
export { Hook, SectionCards, ArgumentFlow, ConceptGrid, ExampleCompression, CompareTable, QuoteCarousel, Quiz, Takeaways, Bridge, Glossary } from "./blocks.jsx";
export { ConceptMap } from "./ConceptMap.jsx";
export { DragSort } from "./DragSort.jsx";
export { Callout, Card, Grid, Reveal, Tabs, StepThrough, Toggle, Timeline } from "./primitives.jsx";

// ---- 数理教科书组件（说明见 framework/spec/TEXTBOOK.md）----
export { M, Eq, EqRef, FigRef, SecRef, ExRef, Tx, TxI, Rich, RichParas, EqLine, FitTex, extendInline, plainText, renderTex, symbolsIn, useTextbook } from "./math/tex.jsx";
export { Sec, Sub, Box, Derivation, Figure, Exercise, Notation, Table, KeyEquations, Details, EqChip } from "./math/env.jsx";
export { Roadmap, EqMap } from "./math/overview.jsx";
export { Plot, num } from "./math/plot.jsx";
export { TextbookPage } from "./math/textbook.jsx";
// ---- 定理–证明类文本（论文、数学书）：陈述登记表由 book.js 的 statements 提供；说明见 framework/spec/PROOF.md ----
export { SRef, Stmt, Proof, Erratum, RunCard, Check, MatrixView, DepGraph, StudyTable, Slider, Seg, pageIds, statements, stmtLabel, anchorOf } from "./math/proof.jsx";

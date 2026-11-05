// Mingbai.js component kit. Chapter files import everything from "@kit". See spec/KIT.md
export { Paras, shuffle, PALETTE, useReveal, useToast, useChapter, ConceptChip, C } from "./core.jsx";
export { ChapterPage, BookPage, Block, Hero } from "./layout.jsx";
export { book, modules, allConcepts, chapterGroups, chapterLabel, chapterNo, titleOf, nameOf, crossLinks, pageUrl, assetUrl, currentPage, hasChapter, go } from "./book.jsx";
export { t, lang } from "./i18n/index.js";
export { Hook, SectionCards, ArgumentFlow, ConceptGrid, ExampleCompression, CompareTable, QuoteCarousel, Quiz, Takeaways, Bridge, Glossary } from "./blocks.jsx";
export { ConceptMap } from "./ConceptMap.jsx";
export { DragSort } from "./DragSort.jsx";
export { Callout, Card, Grid, Reveal, Tabs, StepThrough, Toggle, Timeline } from "./primitives.jsx";

// ---- Math and science textbook components (see spec/TEXTBOOK.md) ----
export { M, Eq, EqRef, FigRef, SecRef, ExRef, Tx, TxI, Rich, RichParas, EqLine, FitTex, extendInline, plainText, renderTex, symbolsIn, useTextbook } from "./math/tex.jsx";
export { Sec, Sub, Box, Derivation, Figure, Exercise, Notation, Table, KeyEquations, Details, EqChip } from "./math/env.jsx";
export { Roadmap, EqMap } from "./math/overview.jsx";
export { FormulaMap } from "./math/fmap.jsx";
export { Plot, num } from "./math/plot.jsx";
export { TextbookPage } from "./math/textbook.jsx";
// ---- Theorem-proof texts (papers, math books): the statement registry comes from statements in book.js; see spec/PROOF.md ----
export { SRef, Stmt, Proof, Erratum, RunCard, Check, MatrixView, DepGraph, StudyTable, Slider, Seg, pageIds, statements, stmtLabel, anchorOf } from "./math/proof.jsx";
// ---- Paper guides: gap → motivation → solution → result; see spec/PAPER.md ----
export { PaperPage, PaperCite, GMSR, PaperSec, GapMap, Stakes, KeyIdea, Pipeline, Headline, Claim, ClaimBoard, Limits, EditorView, ReadingGuide, ROLES } from "./paper/paper.jsx";
export { Weighted, Key, P, BigEq, MinorEq, Fold, Number as KeyNumber, Assume, Verdict, AboveFold } from "./paper/weighted.jsx";

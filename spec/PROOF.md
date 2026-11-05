# Components for theorem–proof texts (papers, math books)

[简体中文](zh/PROOF.md)

These come from the ETH paper book ([full example](https://github.com/EvoEvolver/mingbai-notes/blob/main/eth)) and are now part of the framework in `kit/math/proof.jsx`, imported from `@kit`.
For the general math and science components (`TextbookPage / Sec / Sub / Eq / Tx / Box / Derivation / Roadmap / EqMap / Plot / ConceptGrid / Quiz …`), see `TEXTBOOK.md`; use them as usual.

```jsx
import { Stmt, SRef, Proof, Erratum, DepGraph, pageIds, StudyTable, RunCard, Check, MatrixView, Slider, Seg } from "@kit";
```

## Data: the statement registry (`statements` in book.js)
This is the single source of data for the whole book. Write a registry file in the book directory (such as `chapters/_stmts.js`; files starting with an underscore aren't treated as chapters) and import it from `book.js`:

```js
// book.js
import { STMTS } from "./chapters/_stmts.js";
export default { kind: "textbook", statements: STMTS, /* optional */ statementKinds: { … }, statementStatus: { … }, … };
```

When several agents write different chapters in parallel, use **one registry per chapter**, `chapters/_<chapter>_stmts.js` (`export const S = {…}`), and merge them in book.js:
`import { S as S05 } from "./chapters/_ch05_stmts.js"; … statements: { ...S01, ...S05, … }` ([example](https://github.com/EvoEvolver/mingbai-notes/blob/main/nakahara/book.js)).

⚠ When a registry is written with ``R`…` `` (String.raw), JS treats `${` as interpolation, so in LaTeX never let `$` be immediately followed by `{` (write `${}^{-1}` as `$(\cdot)^{-1}$`). The registry is imported directly by book.js, so one syntax error stops the whole book from building; `check.sh` runs a syntax check first.

Each statement is keyed by id (such as `L2.1 P3.2 D4.2 T5.1`; for unnumbered assertions that play a part in the proof chain use `F:…`, for external citations `X:…`, for corollaries `C:…`):

| Field | Meaning |
|---|---|
| `kind` | `definition` `lemma` `proposition` `theorem` `corollary` `fact` (unnumbered assertion) `cited` (external citation) `claim` `conjecture` `example` |
| `n` | Number in the source (such as `"2.1"`, `"(2.2)"`) |
| `ch` | Id of the chapter page it's on (for cross-page jumps) |
| `en` / `zh` | Title in English / Chinese. An English book writes only `en`; a Chinese book writes `zh` and may add `en` as a subtitle |
| `page` | Page number in the source |
| `stmt` | The statement in the book's language (math written as `$…$`, matching the source character for character) |
| `deps` | Ids of statements or equation numbers the proof directly uses |
| `role` / `key` / `pitfall` | Role in the overall proof / key step / where readers tend to get stuck |
| `status` / `statusNote` | `checked` verified step by step · `filled` abbreviated in the source, filled in by this site · `note` has a note; and an explanation |
| `eq` | Optional: the corresponding equation number |

**The dependency graph, hover previews, and "Used by" lists are all derived from `deps` automatically.** Kind names and status text have defaults, which you can override with `statementKinds` / `statementStatus`.

## Components
| Component | Purpose | Interface |
|---|---|---|
| `<Stmt id>` | Theorem environment: numbered heading + statement in the book's language + 📒 study notes (role, dependencies, used by, key step, sticking point, check notes) + children (the proof) | `notes={false}` hides the notes; `toc={false}` keeps it out of the side table of contents; anchor `<page>/#thm-<id>` (colons become `_`) |
| `<SRef id>` | Statement reference: hover to preview the full statement, click to jump (also across pages) | Can take children for custom text |
| `\sref{ID}` | Inline statement reference | Works in **all** text that supports formulas (Tx/TxI, Sec's gist/why, Box, Derivation, Table, Hook, Bridge, Takeaways, Quiz, concept cards…) |
| `<Proof steps title collapsed source qed>` | Step-by-step proof: each step is `{claim, tex?, why?, uses?:[statement ids or equation numbers], fill?:true}`; `fill` marks "filled in by this site"; can be revealed step by step | claim/why support `$…$`, `\eqref{}`, `\sref{}` |
| `<DepGraph ids highlight focus>` | Proof dependency graph (layered top-down, with what's depended on at the top); hover to highlight upstream and downstream, click to see the statement | `ids` defaults to all; `pageIds("ch04")` = that page's statements and their direct neighbors upstream and downstream |
| `<StudyTable ids>` | Statement overview: role, dependencies, check status | |
| `<Erratum kind loc title>` | `kind="erratum"`: suspected error (give the location, the original wording, the derivation, the suggested wording); `kind="note"` (default): a note | String children are rendered as Tx |
| `<RunCard title lead>` + `<Check ok label detail/>` | Shell and check badge for examples that run in the browser | Write any React inside |
| `<MatrixView M rowGroups colGroups title highlight rowLabels colLabels cell show>` | Small matrix heat map (rationals `{n,d}` or numbers; positive blue, negative red; group dividers) | |
| `<Slider label value min max step onChange fmt>`, `<Seg options value onChange>` | Controls for examples | `label` is rendered as TxI |
| `statements()`, `stmtLabel(id)`, `anchorOf(id)` | Read the registry, generate labels such as "Lemma 2.1", get anchors | |

Book-specific tools (such as the ETH book's `_rat.js` for rationals and permanent algorithms, and `_ledger.jsx` parameter ledger) still live in their own book directories.

## Writing conventions
- Write all math readers see as `$…$` (use ``R`…` `` for strings with backslashes), and don't spell formulas in Unicode.
- Write study notes (role / key / pitfall / status) for every numbered statement. Fill in steps the source abbreviates inside `<Proof>` and mark them `fill`. Mark errors with `<Erratum kind="erratum">`, stating the location and derivation matter-of-factly.

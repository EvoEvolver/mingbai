# Math and science textbooks → HTML authoring spec (for agents writing chapters)

[简体中文](zh/TEXTBOOK.md)

## Goal
Turn **one chapter** of the original book into an interactive HTML textbook. Readers are students who really want to learn the subject (physics or astronomy graduate level). The page has **two layers**, and neither can be missing:

**① High-level understanding layer (a map first, as in a humanities guide)**: before entering the derivations, readers know what this chapter answers, how many steps it takes, what each step yields, what the core concepts are, and which key equations lead to which.
**② Rigorous body layer (the actual textbook)**: every section and subsection of the original (same numbering), every **numbered equation**, every figure, and every exercise is present; derivations aren't omitted, and formulas are checked character by character.

### Write your own explanation; don't translate the book
The body is a re-explanation in the style of a teacher's lecture, not a translated or paraphrased edition. Don't rewrite or translate sentence by sentence in the book's order. Reorganize each section along your own lecture route (problem/motivation → core idea → your own derivation route → interpretation and pitfalls), and write all the text connecting the formulas yourself. Formulas and numbering may be transcribed from the book; the book's own words appear only as brief quotes of a sentence or two (in quotation marks, with the source). Self-check: for each section, compare 3 random passages from the book; the page shouldn't have paragraphs that correspond to them sentence by sentence. Prefer drawing your own figures (SVG or interactive) rather than cropping them from the PDF.

### Errata: write it correctly, don't accommodate the book
If the book has an error (typo, missing factor, sign error, wrong numbered reference, wrong unit, and so on), **write the correct version directly in the body** (equation numbers stay the same; update the body, say, the notation dictionary, and interactive figures together), and next to it use `<Box kind="warning" title={R`Erratum: …`}>` to state what the book printed, what's wrong with it, and the basis for the correction (derivation, dimensional analysis, or numerical verification). If you aren't sure, keep the original formula and title the box `Uncertain: …`. Interactive figures plot only the correct result: don't plot a comparison curve of the "book's misprint", and don't provide a switch or multiplier that reproduces the misprint (giving the original value in the erratum box's text is enough).

### Making formulas understandable is the top priority
- Every formula on the page can be **clicked to enlarge**. The enlarged window automatically lists "what each symbol in the formula means", and every symbol in a formula can be **clicked on its own** to see its definition. All of this depends on the chapter's **notation dictionary `notation`**, which must **cover every symbol appearing in the chapter's formulas** (the self-check's `symMiss` must reach zero or contain only justified exceptions).
- Every numbered equation needs a `say`: a one-sentence "reading" in the book's language that says what the equation means physically (not just reading out the symbols). Example: `say="Photon energy is inversely proportional to the scale factor: when the universe doubles in size, photon energy halves."`

### Style: a teacher's lecture, not a translation
- **Don't follow the book sentence by sentence.** Each section's structure is: **motivation/picture** (why take this step, what we're trying to get) → **core derivation** (key steps stay in the body; long algebra goes in a collapsed `<Derivation collapsed>`) → **interpreting the result** (physical meaning, orders of magnitude, limiting cases) → **summary and transition**.
- Keep every argument step, assumption, approximation condition, and numerical conclusion from the book, but you may reorder them, merge paragraphs, and add signposts ("What we're going to do now is…", "Note the … approximation used here").
- Write in the book's language. In a Chinese book, give the English term when a technical term first appears (共形时间 conformal time).
- **Enhancements (add only, don't remove)**: where the book says "it is straightforward to show", fill in the steps with `<Derivation>`; `<Box kind="physics">` for physical pictures, `<Box kind="warning">` for pitfalls; **interactive figures**: at least 3 `<Plot>` per chapter (really computed in the browser, with values verified against the book).
- **Copyright**: don't copy whole passages of the book's text; the body is your own explanation in the book's language; restate exercises in the book's language in your own words (keeping values and conditions exactly).

## Page structure (in order)
```
TextbookPage (renders automatically: title, one_liner, big_question, why_it_matters, overview, learning objectives, prerequisites)
  <Block toc="Opening"><Hook title>a modern or intuitive scenario as a lead-in</Hook></Block>
  <Block toc="Roadmap" title="Chapter roadmap"><Roadmap steps=[one per section: sec,title,gist,gives,next]/></Block>
  <Block toc="Derivation map" title="How the key equations follow"><EqMap edges=[…]/></Block>          ← 10–25 nodes covering the chapter's main derivations
  <Block toc="Core concepts" title="Core concepts"><ConceptGrid/></Block>                         ← 8–12 physics concept cards
  <Sec n gist why gives> … body … </Sec> × each section of the book                               ← every Sec has gist/why/gives
  <Block toc="Summary"><Takeaways/> <Quiz/> (5–6 concept self-check questions) <Bridge>next chapter</Bridge></Block>
  (Exercises Sec)
  (automatic: the chapter's key equations, notation table)
```
`Block / Hook / ConceptGrid / ConceptMap / Takeaways / Quiz / Bridge / C` work the same as in the humanities version (see KIT.md). The `concepts` format is the same as in the humanities version (id, name_zh, name_en, icon, group, plain, explain, analogy, book_example{what,point}, misconception), and they're passed in through `TextbookPage`'s `groups/concepts/relations`. In the body, `<C id="…">` can link to concept cards (must be written in JSX; not supported inside Tx strings).

## Theorem–proof content
Papers, math books, and other texts built on definitions, lemmas, theorems, and proofs additionally use `Stmt / SRef / \sref{} / Proof / DepGraph / Erratum / RunCard …` (with the statement registry in `statements` in book.js). See `spec/PROOF.md`; the complete example is the ETH book at `/home/zijian/books/eth`.

## Links
Use `pageUrl(id, anchor)` for in-site links and notation such as `\eqref{}` for references; a chapter's exported notation, concepts, and so on must be plain data. See `DEPLOY.md`.

## Examples
Finished pilot chapter: [`cosmo/chapters/ch02.jsx`](https://github.com/EvoEvolver/mingbai-notes/blob/main/cosmo/chapters/ch02.jsx) and the `_ch02_*.jsx` files in the same directory (in the mingbai-notes repo).

## Materials (using Modern Cosmology as the example, book directory `cosmo`)
- Text layer: `text/<id>.txt`, segmented by PDF page, with each page's header giving the path of its page image. **Math in the text layer is corrupted**, so use it only for reading the prose and locating equation numbers.
- Page images: `src/pages/p-NNN.png` (150 dpi). **All formulas must be transcribed by looking at the page images** (open the PNG with Read).
- Figures: `public/figures/fig-<n>.png`, with the list and the book's captions in `public/figures/figures.json`.
- The book's exercise solutions (partial): Appendix A, `text/appA.txt` and the corresponding page images.
- KaTeX macros (book-level; see `book.js`): `\H`=𝓗, `\Om \OL \Or \Ob \Oc \OK`, `\Mpc \hMpc \eV \dd \vk \vx \vp \phat`.

## Files
- Write: `<BOOK>/chapters/<id>.jsx` (the main file) + `_<id>_s1.jsx`… split by section, `_<id>_plots.jsx`, `_<id>_overview.jsx` (roadmap, concepts, and so on). Files starting with an underscore aren't treated as chapters.
- **Write only your own chapter's files**; don't change the framework, `book.js`, or other chapters.

## Components (`import { … } from "@kit"`)
Always use `const R = String.raw;` and write all LaTeX with ``R`...` ``.
```jsx
export const meta = { id:"ch02", no:2, title_en, title_zh, pages:"21–56",
  one_liner: R`the chapter in one sentence`, big_question: R`the question this chapter really answers`, why_it_matters: R`…`,
  overview: R`…`, objectives:[R`…`], prereq:[{ ch:"ch01", what:"…" }] };
export const notation = [ … ];   // notation dictionary (see below)
export const groups = [ … ], concepts = [ … ], relations = [ … ];
export default function Chapter(){ return <TextbookPage meta={meta} notation={notation} groups={groups} concepts={concepts} relations={relations}> … </TextbookPage>; }
```
### The notation dictionary `notation` (makes formulas clickable)
`{ sym, name, en?, def, unit?, eq? }`
- `sym`: **only the symbol itself** (including any distinguishing subscript), such as `R`H_0``, `R`T_\nu``, `R`\Omega_{\rm m}``, `R`\dot a``, `R`\Gamma^\mu{}_{\alpha\beta}``. Don't write `H=\dot a/a` or `a(t)` (definitions go in def).
- Matching rule: a "base + subscript" in a formula first matches exactly (`T_\nu`), then falls back to an entry with only the base (`T`). So you need both general entries (`T` temperature, `\rho` energy density, `\Omega` density parameter) and important specific entries (`T_\nu`, `\rho_\gamma`, `\Omega_{\rm m}`, `H_0`). Indices in subscripts and superscripts (μ, ν, i, j…) don't take part in matching.
- Include coordinate and index-style symbols too: `t`, `x` (coordinates `x^\mu`/`x^i`), `\boldsymbol{x}`, `p`, `\hat p`, `\eta`, `\lambda` (affine parameter), `\delta_{ij}` (Kronecker δ), `g_{\mu\nu}`, and so on.
- When one letter has two meanings in the chapter: give the entry an `id` field and force it in formulas with `\sym{<id>}{…}` (a short id for the chapter is fine, such as `\sym{Tmn}{T}`), or remove the annotation with `\nosym{…}` (such as for a letter that's purely an index).
- Symbols defined in earlier chapters are available automatically (shared across chapters), and this chapter can override them.
- `def` supports `$…$` and `\eqref{}`; `eq` is the number of the equation where it's defined; `unit` gives the dimension or unit (for dimensionless quantities, write "dimensionless" in the book's language).

### Formulas work everywhere (since 2026-10-30)
`Hook / Bridge / Takeaways / Quiz (question, options, explanation) / all concept card fields / Roadmap titles / Plot captions / Block title and lead / meta.one_liner and the like / book.js intro` all go through `Rich` rendering: strings containing `$…$` or notation such as `\eqref{}` render with KaTeX, and anything else is output as is (humanities books aren't affected). **Write all math readers see as `$…$`, and don't spell formulas in Unicode.** A book can register its own inline notation with `extendInline(name, render)` (imported from `@kit`), such as `\sref{L2.1}` in a paper book; once registered, it works in all text that supports formulas.

### Other components
- `<Sec n title zh gist why gives={["2.12"]}>`, `<Sub n title zh>`: numbering matches the book; gist = the section's point in one sentence, why = why this step is needed, gives = the key equations the section yields. `title` is the heading; a Chinese book puts its heading in `zh`, and `title` then shows as the subtitle.
- `<Tx>{R`…`}</Tx>`: blank lines separate paragraphs; `$…$`, `$$…$$`, `\eqref{}`, `\figref{}`, `\secref{}`, `\exref{}`, `**bold**`, `*emphasis*`.
- `<Eq n="2.23" say="…" keyEq title="…">{R`…`}</Eq>`: numbered display equation; **write a say for every one**; 8–20 keyEq per chapter, at the upper end for long chapters (collected automatically at the end of the chapter; only keyEq shows title). Split multiple numbers into multiple `<Eq>`.
- `<Roadmap steps={[{ sec:"2.1", title:"Expanding space", gist:R`…`, gives:["2.12","2.28"], next:R`transition: why we next need to…` }]}/>`
- `<EqMap edges={[{ from:"2.20", to:"2.28", label:"substitute into FLRW" }]} labels={{ "2.20":"geodesic equation" }}/>`: derivation map of the key equations (nodes show their formulas automatically; click to enlarge).
- `<EqChip n="2.23"/>`: small clickable formula.
- Numbered examples from the book: `<Box kind="example" n="5.12" title="…">` (displays "Example 5.12", anchor `example-5.12`). For theorem–proof textbooks (definitions, theorems, proofs), see also `PROOF.md`; a `check.json` in the book directory lets `tb_check` verify statements, examples, and both kinds of exercises.
- `<Derivation title steps={[{tex, why}]} result collapsed?>`, `<Box kind="definition|result|note|example|physics|warning|aside|key|data" title>`, `<Figure n caption interactive={<Plot/>}>`, `<Plot …>` (numeric tools in `num`), `<Exercise n title level hint solution fromBook>`, `<Table>`, `<Details>`.

For figures you draw yourself, use `<Figure n caption illustration={<MyDiagram/>}>`: it shows the component directly without requesting the book's image, and keeps the original figure number and reference anchor. Prefer SVG for flat structures; for surfaces readers need to rotate, you can load Three.js on demand in `useEffect`, provide a fallback figure for browsers without WebGL, and release resources on unmount.

## Memory discipline (required when several agents run in parallel)
Run all heavy commands, such as builds and Playwright/Chromium screenshots, through `tools/heavy.sh <command…>` (a global lock serializes them and checks memory; `check.sh` already does this). Don't start several builds or browsers in parallel yourself; close temporary http servers and browsers when you're done; don't spawn further subagents.

## Workflow
1. Read the chapter's text layer from start to finish, and list the section structure, equation numbers, figures, and exercises. Write the **high-level understanding layer** first (one_liner, big_question, roadmap, derivation map, concepts); this forces you to think the chapter's logic through first.
2. Write the body section by section: transcribe formulas from the page images, organize the explanation as "motivation → derivation → interpretation → transition", write a say for every `<Eq>`, and extend notation as you go.
3. Add derivations, physical pictures, and interactive figures; then exercises and solutions (check Appendix A).
4. Self-check (all must pass):
   ```bash
   python3 -I spec/tb_check.py <book-dir> <id>   # completeness + structure check → OK
   spec/check.sh <id> <book-dir>                   # errors / texErrors empty; symMiss at zero (or each exception explained)
   ```
   Use Read to view `/tmp/check-<book-dir-name>-<id>/shot.png`; spot-check at least 15 formulas character by character against the page images; screenshot the interactive figures and check their values.
5. Delivery report: file list; tb_check output; remaining symMiss items with reasons; list of interactive figures and how they were verified; added derivations; errata (corrected) and uncertain items.

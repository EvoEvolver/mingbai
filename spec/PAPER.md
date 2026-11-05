# Paper guides (PAPER)

[简体中文](zh/PAPER.md)

Papers are read differently from textbooks. Readers want to know **what gap this paper fills, why it's worth doing, how it was done, and whether it worked**.
A paper page keeps the math and science components (`Eq`, the notation dictionary, `Plot`, `Derivation`, `Box`…; see TEXTBOOK.md) and swaps the narrative skeleton for the components below (exported from `@kit`, source in `kit/paper/paper.jsx`).

## Book configuration
One paper is one "book": in `<dir>/book.js`, set `kind: "paper"` and give `paper: { title, authors, venue, year, arxiv, doi, code, license }`.
There are usually 2–3 pages: `paper` (quick read + full guide, always present), and when needed deep-dive pages such as `method` (method details and derivations) and `results` (experiment details).

## Page skeleton (the paper page)
```jsx
<PaperPage meta={meta} notation={notation} concepts={concepts}>
  <PaperSec role="background">…the least background needed to understand this paper…</PaperSec>
  <PaperSec role="gap">        <GapMap rows criteria gap/> </PaperSec>
  <PaperSec role="motivation"> <Stakes chain payoff/> </PaperSec>
  <PaperSec role="solution">   <KeyIdea/> <Pipeline steps/> …equations and interactive figures… </PaperSec>
  <PaperSec role="result">     <Headline/> <ClaimBoard/> <Claim>…evidence…</Claim> </PaperSec>
  <PaperSec role="limits">     <Limits/> </PaperSec>
  <PaperSec role="editor">     <EditorView/> <ReadingGuide/> <Quiz/> </PaperSec>
</PaperPage>
```
Additional meta fields: `paper` (optional; defaults to book.paper), `tldr` (one sentence), `gmsr: { gap, motivation, solution, result }` (four quick-read cards of 1–2 sentences each, shown at the top of the page; clicking one jumps to the matching `PaperSec`).

## Components
| Component | Role |
|---|---|
| `PaperSec role` | A major section colored by its role in the argument: gap / motivation / solution / result / limits / background / editor; the first section of each role automatically gets the anchor `role-<role>` |
| `GMSR` | Four quick-read cards (PaperPage renders meta.gmsr automatically) |
| `GapMap rows criteria? gap` | Existing methods × what they can and can't do (criteria + marks: true/false/"partial" draws a comparison table; otherwise rows use does/misses); `ours: true` marks this paper; `gap` is the gap statement |
| `Stakes chain payoff` | Causal chain of the motivation: `[{if, then}]` or an array of strings |
| `KeyIdea analogy` | The one move most worth remembering from the paper |
| `Pipeline steps` | Method flow: `[{title, what, why, out, detail}]`; clicking expands detail (which can hold Eq and interactive figures) |
| `Headline items` | Key numbers `[{value, label, note}]` |
| `ClaimBoard claims` / `Claim id claim strength caveat where` | Claims ↔ evidence. strength is the **editor's** judgment of the evidence: strong / moderate / weak; caveat spells out the scope; where points to the figure, table, or section in the paper |
| `Limits limits open` | Limitations (acknowledged by the authors + seen by the editor) and open questions |
| `EditorView strengths concerns questions` | Editor's commentary, clearly labeled on the page as not representing the authors' views |
| `ReadingGuide rows` | Where in the paper to read, and what to skip, for different goals |

## Formula treemaps (`FormulaMap`)

`FormulaMap` draws a formula's structure as a treemap: nesting shows the structure, and leaf area shows importance. It works in paper and textbook pages. With `n` it replaces `<Eq>`: it registers the equation for `\eqref`, hover previews, and `KeyEquations`, and provides the `eq-<n>` anchor. Use it for long formulas that deserve a walkthrough, not for every equation.

```jsx
const TREE = {                                   // define at module level
  id: "eq", tex: String.raw`#lhs\approx#rhs`, name: "approx", label: "One-line meaning", role: "const",
  kids: [
    { id: "lhs", tex: "F", w: 4, name: "figure_of_merit", label: "Lower is better", role: "result", note: "Full note." },
    { id: "rhs", tex: String.raw`\sqrt{#S/#N}`, name: "per_param", label: "Normalization", role: "const", kids: [
      { id: "S", tex: "S'", w: 3, name: "time_cost", label: "Shots", role: "design" },
      { id: "N", tex: "N", w: 1, name: "n_params", label: "Parameters", role: "const" },
    ] },
  ],
};
<FormulaMap n="28" keyEq title="Short title" say="What it says in words." tree={TREE} start="S" />
```

- **The tree is the formula.** The displayed TeX is generated from `tex`, with `#childId` placeholders that must match `kids` one to one. Ids contain only letters and digits. Symbols not in a child, such as `=`, `√`, and `∑`, belong to the node. The root is the relation (`=` or `≈`).
- **Area:** `w` on a leaf is its importance, and area is proportional to it. Parents have no `w`. No node is ever dropped. The inline map grows from `height` (460) up to `maxHeight` (520), and past that its leaves get smaller. Readers can open any map in a full panel, which has room for every node.
- **Fields:** `name` is a code-like name, `label` a short meaning, `note` the full explanation, and `role` one of `unknown`, `known`, `design`, `const`, or `result`. `glyph` overrides what a parent's title shows, which nodes with no visible symbol need (`\times` for implicit multiplication).
- **Limits:** a placeholder can't span `&` or `\\`, so multi-line `aligned` formulas don't work.

## Writing requirements
- **Write the explanation yourself**: don't translate sentence by sentence or rewrite the paper's paragraphs; reorganize it as "gap → motivation → solution → result". Use the paper's own words only as short quotations.
- **Draw the figures yourself**: redraw result figures as interactive figures using data reported in the paper (values, trends) or our own numerical experiments; don't crop figures from the paper.
- **Claims need evidence**: each `Claim`'s evidence points to a specific figure, table, or section of the paper, or to our reproduction. Label the strength of evidence honestly, and put the conditions of validity in caveat.
- **Interactive figures should demonstrate the core mechanism first**: readers can drag parameters and see why the solution works (if necessary, use a scaled-down toy version that computes in the browser, and state how it differs from the paper's scale).
- Credit the source and license (PaperCite shows `paper.license` automatically).
- The self-check is the same as for textbooks: `spec/check.sh <page-id> <book-dir>` (errors / texErrors / symMiss empty), and check the screenshots.

## Importance weighting (`<PaperPage weighted>`)
The biggest obstacle to reading a paper full of formulas is that **a piece of information's importance isn't proportional to the page area it takes up**. Key formulas are the same size as routine algebra, the assumptions that decide the conclusion hide in small print, and skimming easily misses what really matters. Weighted mode makes area and visual weight follow importance.

Each piece of content has a weight: **3 = must see** (core claim, key formula, decisive number, key assumption, concluding sentence); **2 = body text**; **1 = detail** (routine derivations, digressions; folded when skimming).

| Component | Weight | Usage |
|---|---|---|
| `P w={3/2/1} label` | 3/2/1 | Paragraph. w=3 is enlarged and bold with a color bar, and is registered in the importance map under label |
| `BigEq n meaning label parts` | 3 | Key formula: first a large plain-language `meaning` (what this equation is saying), then the enlarged formula; `parts:[{tex, note}]` marks the parts most worth watching |
| `MinorEq n …` | 1 | Minor formula (smaller; hidden when skimming) |
| `Fold title steps` | 1 | Folds a routine derivation into one line; expand to see the details |
| `KeyNumber value label why` | 3 | Decisive number |
| `Assume title` | 3 | Key assumption or precondition (the kind papers often write in small print) |
| `Verdict` | 3 | "So…" concluding sentence |
| `AboveFold` | — | First screen: the most important formulas, numbers, and assumptions side by side, so readers get the core without scrolling |

The page automatically provides a "Skim / Read" switch at the bottom left and an "Importance map" on the right edge (the positions of weight-3 items across the page; click to jump).

**Writing discipline**: weight 3 must be scarce (1–3 per section, 15–25 per page), or it loses its meaning. Write any conclusion that fits in one sentence as `P w={3}` or `Verdict`, and don't bury it in a long paragraph. Keep only the one or two derivation steps readers must follow as body text, and put the rest in `Fold`.

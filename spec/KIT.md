# Chapter writing guide

[简体中文](zh/KIT.md)

## Goal
Turn **one chapter** of the original work into a lively, easy-to-follow React page. Target readers: smart people who read the book's language and haven't read the original.
Originals often suffer from **too many examples and obscure concepts**. Your job:
- **Extract the core concepts** and explain them fully in plain language with modern analogies;
- **Compress the examples**: point out that a string of examples is really proving one thing, and keep only the 1 most representative example from the book for each concept;
- **Trace the line of argument**: let readers see what the chapter is arguing, step by step;
- **Build at least 1 interactive diagram specific to this chapter** (this is where the page shines most): find the chapter's most central structure that's best suited to visualization (a model, a table, a process, a shift) and make it a clickable, switchable, animated SVG/HTML component.
- Stay faithful to the original and don't invent things. List anything you're unsure about in your delivery reply.

**Copyright constraint**: don't transcribe long passages of the original. Quote at most 4 passages, each ≤ 25 English words; rewrite everything else in your own words in the book's language.

Write all reader-facing text in the book's language, keeping terms from the original as they are (such as *mathesis*); see "UI languages" at the end.

## Files
- Source text: `<book-dir>/text/<file>.txt` (plain text with section headings; notes at the end can be ignored). You must read the whole text, in segments.
- You write: `<book-dir>/chapters/<id>.jsx` (the main chapter file), and you may add helper files `<book-dir>/chapters/_<id>_*.jsx` (files starting with an underscore aren't treated as chapters).
- **Write only your own chapter's files.** Don't change the framework, `book.js`, or other chapters. If a general component is missing, write it in your own `_<id>_*.jsx`.
- **Examples (required reading; match their structure and quality)**: [`oot/chapters/ch02.jsx`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/chapters/ch02.jsx) and [`_ch02_similitudes.jsx`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/chapters/_ch02_similitudes.jsx) (in the mingbai-notes repo).
- Component library source: `app/src/kit/` (index.js lists all exports). Style variables are in `kit/style.css` (`--paper --ink --muted --line --accent --gold --blue --green --violet --card --shadow --serif --sans`).

## Chapter file conventions
```jsx
import { ChapterPage, Block, ... } from "@kit";
export const meta = { id:"ch03", no:3, title_zh, title_en, era, one_liner(≤25 words; Chinese ≤45 chars), big_question, why_it_matters(2-3 sentences), original_words, read_minutes };
export const groups = [{id,label}];            // 2-5 concept groups (for filtering and colors)
export const concepts = [{ id(snake_case), name_zh, name_en, icon(single emoji), section_id, group,
  plain(≤20 words in plain language; Chinese ≤35 chars), explain(2-3 paragraphs separated by \n\n, 80-160 words; Chinese 150-300 chars), analogy(modern analogy, 30-65 words; Chinese 60-120 chars),
  book_example:{what, point}, misconception }];   // 8-14 of them
export const relations = [{from, to, label(≤4 words; Chinese ≤8 chars)}];   // 10-18 of them
export default function Chapter() { return <ChapterPage meta={meta} groups={groups} concepts={concepts} relations={relations}> ...blocks... </ChapterPage>; }
```
`meta / groups / concepts / relations` **must be exported** (the book map page references them across chapters).

An English book writes only the `*_en` fields here; a Chinese book writes `*_zh` and may add `*_en` as a subtitle (see "UI languages"). Length limits are given in English words, followed by the limit in characters for a Chinese book.

## Components (from "@kit")
Shell and blocks
- `<ChapterPage meta groups concepts relations>` automatically renders the Hero (title, one-liner, big question), a progress bar, the side table of contents, and previous/next chapter navigation.
- `<Block id toc kicker title lead>` is one block; it enters the table of contents only if it has `toc`. The table of contents is a column of bars on the right of the page that expands into a heading panel on hover. `<Sec>` is level one, `<Sub>` and `<Stmt>` are level two, and all of them enter automatically. Custom elements can add `data-toc="title"` (optionally `data-toc-level="2"`).
- `<C id="concept_id">text</C>` is an inline concept link in the text; clicking it opens the concept card. `<ConceptChip id>` is the pill version.

Standard blocks (in the recommended order; add, remove, or adjust as needed, and don't force in anything that doesn't suit the chapter)
- `<Hook title>text</Hook>` opens with a modern scenario (65-110 words; Chinese 120-200 chars)
- `<SectionCards sections=[{id,no,title_zh,title_en,gist,summary(45-80 words; Chinese 80-150 chars),concept_ids}]>` maps one-to-one onto the original's sections
- `<ArgumentFlow steps=[{claim,detail}]>` is the line of argument in 6-10 steps
- **The chapter-specific diagram** (write it yourself)
- `<ConceptGrid/>` shows the concept cards (reads the ChapterPage data)
- `<ConceptMap height?/>` shows the concept relationship map
- `<ExampleCompression items=[{examples:[{tag, detail}...], says}]>` has 3-5 groups of 3-6 examples each. **Write a `detail` for every example**: `tag` is a short label (≤6 words; Chinese ≤12 chars), and `detail` is 2-4 sentences (30-80 words; Chinese 60-150 chars) saying what the example specifically is in the original, how the author uses it, and what it shows. Readers expand it by clicking the tag, so never give just a name they can't make sense of. `says` is one sentence stating what the string of examples jointly proves. (The old form `examples:[strings]` still works but isn't recommended.)
- `<DragSort categories=[{id,label}] items=[{text,answer,why}]>` only when the chapter has a natural classification structure, 8-12 items
- `<CompareTable left right rows=[{aspect,left,right}]>` 5-7 rows, usually this chapter's episteme vs the previous episteme, or vs today's intuition
- `<QuoteCarousel quotes=[{en,zh,meaning}]>` ≤4 quotes, en ≤25 words
- `<Quiz questions=[{q,options[4],answer,why}]>` 5-6 questions testing understanding rather than memory, with the correct answer's position varied
- `<Takeaways items>` 3-5 items + `<Bridge>` linking to the next chapter (30-65 words; Chinese 60-120 chars). The last chapter wraps up the whole book; a preface says how to enter Chapter 1
- `<Glossary terms=[{term,zh,def}]>`

Building blocks for custom diagrams
- `<Callout tone="info|warn|key|quote" title>`, `<Card>`, `<Grid min>`, `<Reveal>`
- `<Tabs tabs=[{label,content}]>`
- `<StepThrough steps=[{label,content}] render={i => <svg>…</svg>}>` explains in steps, with a figure that changes at each step (great for processes and derivations)
- `<Toggle options={["Classical","Modern"]}>{v => ...}</Toggle>` compares two or more states with a switch
- `<Timeline events=[{year,label,note}]>`
- `useChapter()` gets `{byId, open(id), color(groupId)}`; `useReveal()`; `useToast()`
- You can also write SVG + `useState` directly (see `_ch02_similitudes.jsx`; use viewBox so SVG scales, and SMIL `<animate>` for motion).

## Links and routing
The site is a multi-page static site: one page `<id>/` per chapter, with plain hashes for anchors within a page (such as `ch02/#eq-2.23`). **Don't hand-write `#/…`** for in-site links;
use `pageUrl(id, anchor)` (from "@kit"; `pageUrl(null)` is the shelf). A chapter's exported `meta / concepts / groups / relations / notation / links`
are extracted into a whole-book index at build time and **must be plain data** (no functions or JSX). See `spec/DEPLOY.md` for details.

## Self-check (required)
```bash
spec/check.sh <id> <book-dir>
```
It builds your chapter alone, takes screenshots, and outputs a JSON report (block list, console errors). Requirements:
1. The build succeeds and `errors` is empty;
2. Use the Read tool to view the screenshots `/tmp/check-<book-dir-name>-<id>/shot.png` (full-page) and `shot-modal.png`, and confirm that the layout is fine and the chapter-specific diagram renders correctly. You can screenshot that diagram alone:
   first run `python3 -m http.server <port> -d /tmp/check-<book-dir-name>-<id>/site &`, then `node tools/pw/el.mjs "http://localhost:<port>/<id>/" "#b-<blockid>" /tmp/check-<book-dir-name>-<id>/el.png`, and kill the server when you're done.
3. If something's wrong, fix it, and repeat until you're satisfied.

## Delivery reply (brief)
File list; list of concept ids; what the chapter-specific diagram does; anything you're unsure about in your understanding of the source text.

## Reader feedback (enabled once an address is set)
`kit/Feedback.jsx`: when a reader selects any text, a floating "✎ Feedback" button appears. It opens a panel for writing feedback, and "Send by email" opens the reader's mail program through `mailto:` (the body contains the page address, the page title, the selected plain text, the feedback, and optional contact details; at most 600 characters of the selection are included). "Copy text" is the fallback. The recipient address is `FEEDBACK_EMAIL` in `kit/site.js` (when empty, the feature isn't shown), and a single book can override it with `feedbackEmail` in book.js. Chapter authors don't need to do anything.

## UI languages
A book has exactly one UI language, set by `lang` in `book.js`. The default is `"en"`; `"zh"` is also available. It controls all text built into components (buttons, hints, footers, "Chapter N", and so on), `<html lang>`, the Latin-script fonts, and the read-aloud voice. Book content isn't translated: a book's prose is in whatever single language it's written in, and the page shows that.

- **Writing an English book**: no `lang` is needed. Write titles and names only as `title_en` / `name_en` (statements only as `en`), with no `*_zh` fields. `zh` in `quotes` and `zh` on `Sec` can be omitted too.
- **Writing a Chinese book**: add `lang: "zh"` to `book.js` and write `*_zh` fields (statements as `zh`). Components show `*_zh` first and fall back to `*_en`; when both are present, `*_en` is the subtitle.
- **Adding new UI text**: don't hard-code it in a component. Add a key to both `kit/i18n/zh.js` and `en.js`, and get it with `t("key")` (`from "./i18n/index.js"`; in chapter files, `from "@kit"`). Write sentences with arguments as functions, such as `"ch.no": n => \`Chapter ${n}\``. You can use `t()` in default parameters, but don't call it at module top level.
- **Adding a new language**: write a copy of `kit/i18n/zh.js` and register it in `kit/i18n/messages.js`. Missing keys fall back to the default language, English. The library home page (`library/index.html`) keeps its own UI text, in English and Chinese only, and follows the `lang` of the first book in the library.

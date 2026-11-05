<div align="center">

# Mingbai.js

**Make hard books clear.**

A framework for turning books and papers into interactive learning sites: click into equations, play with models, and hear the harmony.

[简体中文](README.zh-CN.md) · [Live example (in Chinese)](https://evoevolver.github.io/mingbai-notes/)

<img src="docs/screenshots/formula-map.png" alt="FormulaMap: an equation unfolded into a tree, with area showing importance and the matching part of the formula highlighted on hover" width="720">

</div>

This repo holds only the framework, with no books. [mingbai-notes](https://github.com/EvoEvolver/mingbai-notes) is a library built with it and the most complete reference for how to write a book.

## What it looks like

The screenshots come from mingbai-notes, which is written in Chinese. The interface also comes in English, the default.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/equation.png" alt="An enlarged equation explained symbol by symbol"><br><b>Equations, symbol by symbol:</b> open any equation to see what it says and what each symbol means</td>
<td width="50%"><img src="docs/screenshots/concept-map.png" alt="A draggable concept map"><br><b>Concept maps:</b> drag and zoom, and click a node for its concept card</td>
</tr>
<tr>
<td><img src="docs/screenshots/proof-graph.png" alt="A proof dependency graph"><br><b>Proof graphs:</b> select a statement to highlight what it depends on and what depends on it</td>
<td><img src="docs/screenshots/harmony.png" alt="A playable Tonnetz harmony grid"><br><b>Playable harmony:</b> click a triangle to hear its chord, or an intersection to hear one note</td>
</tr>
<tr>
<td colspan="2"><img src="docs/screenshots/toc.png" alt="The heading panel expanded from the table of contents on the right"><br><b>Table of contents:</b> a column of bars on the right that expands into a heading panel on hover</td>
</tr>
</table>

## Components

- **Humanities guides:** core concept cards, lines of argument, concept maps, example compression, and quizzes.
- **Math and science textbooks:** enlarged equations with symbol-by-symbol explanations, cross-chapter references, derivation steps, and interactive plots.
- **Theorems and proofs:** a statement registry, step-by-step proofs, dependency graphs, and runnable examples.
- **Paper guides:** a gap → motivation → solution → result structure, importance-weighted reading, and the `FormulaMap` treemap.
- **Music:** playable scores, keyboards, chord progressions, and a Tonnetz.

The output is plain static pages, one address per chapter, which you can deploy to any static host. The interface is available in English (default) and Chinese.

## Quick start

You need Node.js 24 and Python 3.

```bash
git clone https://github.com/EvoEvolver/mingbai.git
npm ci --prefix mingbai/app
```

A book is a directory outside the framework with at least a `book.js` and one chapter:

```
my-book/
  book.js
  chapters/ch01.jsx
```

```js
// my-book/book.js
export default {
  title: "My Book", author: "Me", subtitle: "2026", intro: "What this book is about.",
  chapters: [{ id: "ch01", no: 1, title_en: "First steps" }],
};
```

```jsx
// my-book/chapters/ch01.jsx
import { ChapterPage, Block, Hook } from "@kit";

export const meta = { id: "ch01", no: 1, title_en: "First steps", one_liner: "Where it all begins." };

export default function Chapter() {
  return (
    <ChapterPage meta={meta} concepts={[]}>
      <Block id="hook" toc="Opening"><Hook title="Hello">My first page.</Hook></Block>
    </ChapterPage>);
}
```

Build and preview, using an absolute path for `BOOK`:

```bash
cd mingbai/app
BOOK=/path/to/my-book npx vite build      # writes to my-book/dist
python3 -I ../serve.py /path/to/my-book 8848
```

Then open `http://localhost:8848`.

For a Chinese interface, add `lang: "zh"` to `book.js`.

## Building a library from several books

Put your books in one directory and list their directory names, one per line, in `<library-root>/library/books.txt`. The list sets the order; without it, every directory with a `book.js` is included.

```bash
cd /path/to/library-root
/path/to/mingbai/build-library.sh --build   # writes to library/dist
```

To build only some books, run `build-all.sh book-a book-b`. Books are looked up in the current directory, or in `BOOKS_DIR` if you set it.

## Documentation

| Guide | What it covers |
| --- | --- |
| [spec/NEW_BOOK.md](spec/NEW_BOOK.md) | Adding a new book |
| [spec/KIT.md](spec/KIT.md) | Writing chapters, the component list, and UI languages |
| [spec/TEXTBOOK.md](spec/TEXTBOOK.md) | Math and science textbooks |
| [spec/PROOF.md](spec/PROOF.md) | Theorems and proofs |
| [spec/PAPER.md](spec/PAPER.md) | Paper guides and importance weighting |
| [spec/AUDIO.md](spec/AUDIO.md) | Audio components |
| [spec/DEPLOY.md](spec/DEPLOY.md) | Routing, building, and deployment |

Chinese versions are in [spec/zh/](spec/zh/).

To check a single chapter (build plus screenshots), run `spec/check.sh <chapter-id> <book-dir>`. It needs the screenshot tools first: `npm ci --prefix tools/pw && npx --prefix tools/pw playwright install chromium`.

## License

[MIT](LICENSE)

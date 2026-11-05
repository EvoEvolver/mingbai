# Making a new book

[简体中文](zh/NEW_BOOK.md)

Framework: this repo (React + Vite, with the component library in `app/src/kit`). Complete sample: Foucault's *The Order of Things*, in [`oot/`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot) in the mingbai-notes repo.

## Rules
- **Book code goes in the book directory; don't modify the framework.** Special components a book needs go in its own `chapters/_<id>_*.jsx`.
- The copyright constraint is the same as in `spec/KIT.md`: don't transcribe long passages of the original; quote at most 4 passages per chapter, each ≤25 English words.

## Steps
1. **Create the book directory** `<book-dir>/`, containing:
   - `book.js`: copy the format of [`oot/book.js`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/book.js) (title, title_en, author, subtitle, intro, parts, chapters[{id,no,title_zh,title_en,part,text}]). An English book needs no `lang`, since `"en"` is the default, and writes only `title_en` for chapters. A Chinese book adds `lang: "zh"` and writes `title_zh`, and may add `title_en` as a subtitle (see "UI languages" in KIT.md). Chapter ids are `ch00` (preface or introduction, if any), `ch01`, and so on; divide parts according to the structure of the original.
   - `text/`: one plain text file per chapter. For an epub, run `python3 -I extract.py <xhtml> <out.txt>` (unzip to `<slug>/src/` first); for a PDF, run `pdftotext -layout -f <first-page> -l <last-page>`, using the table of contents first to find each chapter's page range. After extracting, spot-check that chapter boundaries are correct.
   - `chapters/`: the chapter JSX.
2. **One independent subagent per chapter** (in parallel). The instructions for each subagent must include:
   - Read `spec/KIT.md` and the examples [`oot/chapters/ch02.jsx`](https://github.com/EvoEvolver/mingbai-notes/blob/main/oot/chapters/ch02.jsx) and `_ch02_similitudes.jsx` in full first;
   - The self-check command must include the book directory: `spec/check.sh <id> <book-dir>`, with screenshots in `/tmp/check-<slug>-<id>/`;
   - The chapter id, title, source text file, and section structure, plus your suggestion for the chapter's "chapter-specific interactive diagram" (pick the chapter's most central structure that's best suited to visualization);
   - Terms in KIT.md such as "episteme" are examples from the Foucault context; rewrite them to suit this book's line of thought (CompareTable should use what this book actually opposes).
3. After all chapters are done, build and check the whole book yourself:
   ```bash
   cd app && BOOK=<book-dir> npx vite build   # outputs to <slug>/dist
   ```
   Spot-check a few chapters with `node tools/pw/shot.mjs <url> <out.png>` (first start a temporary server with `python3 -m http.server <port> -d <slug>/dist &`, and kill it when you're done).
4. **(Optional, recommended) Book map**: start one more subagent to write `chapters/connections.jsx`: `export const links=[{from:"ch02:<concept-id>",to:"ch05:<concept-id>",label,note}]` (each chapter page automatically gets a "Cross-chapter links" block), and `export default` a page organized with `BookPage` (`<C id="chNN:id">` for cross-chapter references, `<ConceptMap edges={links}>` for the cross-chapter relationship map). See `BookPage` in `app/src/kit/layout.jsx`.
5. **Publish to the library**: add the book's directory name to `<library-root>/library/books.txt` (this sets its position in the library), then run
   ```bash
   build-library.sh --build <slug>   # rebuilds only this book; the library is reassembled (other books use their existing build output)
   ```
6. Delivery report: URL, chapter list, each chapter's specific diagram, and open questions.


## Routing and deployment
The site is a multi-page static site (one `<id>/index.html` per chapter) that can be deployed directly to GitHub Pages; see `spec/DEPLOY.md`.

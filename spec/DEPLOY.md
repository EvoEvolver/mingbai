# Routing, building, and deployment (GitHub Pages friendly)

[简体中文](zh/DEPLOY.md)

## Site structure: a multi-page static site with path-based routing
Each book builds into a plain static directory (`<book>/dist/` by default) that needs no server rewrite rules:

```
dist/
  index.html              shelf
  ch02/index.html         one real page per chapter (loads only this chapter's code + shared framework chunks)
  connections/index.html  book map page (if present)
  assets/…                JS/CSS/fonts (all referenced by relative paths)
  figures/…               static assets from the book's public/
  .nojekyll               keeps GitHub Pages from ignoring files that start with an underscore
```

- Page addresses: `<site>/ch02/`; anchors within a page use plain hashes: `<site>/ch02/#eq-2.23`, `#sec-2.1`, `#fig-2.3`, `#ex-2.4`, `#thm-L2.1`.
- All links and assets use relative paths, so a book can be deployed under any subpath (such as `https://<user>.github.io/<repo>/my-book/`).
- Old-style hash links `#/ch02/eq-2.23` still work: they redirect to `ch02/#eq-2.23` on open, and any leftover `href="#/…"` in content is rewritten automatically.
- Each page's `<title>` and `<meta name="description">` are generated at build time from the chapter's `meta.title_zh` or `meta.title_en` and its `meta.one_liner`.

## Cross-chapter data
At build time (`vite.config.js`), Vite SSR loads each chapter module and extracts its JSON-serializable exports
`meta / notation / groups / concepts / relations / links`, which are injected into every page as the `data` of `virtual:book`.
This data supplies the shelf's one-line summaries, cross-chapter links, cross-chapter concept cards, the cross-chapter notation dictionary, and the book map page, without loading the code of other chapters.
So: **these exports must be plain data** (strings, numbers, arrays, objects); functions and JSX are dropped.

So that chapters in a book directory can resolve dependencies such as `react`, the build automatically creates a symlink `node_modules → <framework>/app/node_modules` in the book directory (already ignored by .gitignore).

## In-site links (when writing chapters)
- Use `pageUrl(id, anchor)` (`import { pageUrl } from "@kit"`): `pageUrl("ch03")`, `pageUrl("ch03", "eq-3.12")`, `pageUrl(null)` (the shelf). On the same page it returns `#anchor`.
- References in text still use `\eqref{3.12}`, `\figref{}`, `\secref{}`, `\exref{}`, and `\sref{}`, and the framework generates the correct cross-page links.
- Current page id: `currentPage()`; whether a chapter exists: `hasChapter(id)`; navigate: `go(id, anchor)`.

## Building
```bash
cd app
BOOK=/path/to/my-book npx vite build                      # → my-book/dist
BOOK=… OUT=/tmp/site npx vite build                       # set the output directory
ONLY=ch02,ch03 BOOK=… npx vite build                      # build only some chapters (the shelf lists only these)
../build-all.sh                                           # all books in the current directory (or BOOKS_DIR)
```

## Deploying to GitHub Pages
Pick one:

1. **gh-pages branch**: put the `dist/` of one or more books into a site directory and push it to the `gh-pages` branch, then select that branch under Settings → Pages in the repo.
   Several books can go in subdirectories: `site/book-a/`, `site/book-b/`, and so on (relative paths keep each one working independently), and you can write an overall index page at `site/index.html`.
2. **GitHub Actions**: in the workflow, run `npm ci` (in the framework's app directory) → `BOOK=… OUT=site/<book> npx vite build` for each book → `actions/upload-pages-artifact` to upload `site/` → `actions/deploy-pages`.
   Note: the source text layer `text/` and the source figures `public/figures/` aren't in the repo (for copyright reasons), so math and science books built in CI will be missing figures. Confirm the copyright permissions before deploying publicly.

Local preview: `python3 -I serve.py <book-dir> <port>` (serves `<book>/dist` directly, mapping directories to `index.html`).

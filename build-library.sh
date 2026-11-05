#!/usr/bin/env bash
# Assemble the library: put the build output of each book into one static site.
#   <OUT>/index.html          library home page (this repo's library/index.html)
#   <OUT>/library.json        book catalog (merged from each book's dist/book.json)
#   <OUT>/<book>/…            each book's site (copied as is from <book>/dist)
# Books directory: env var BOOKS_DIR, defaults to the current directory.
# Usage: build-library.sh [--build [book-dir…]]
#   --build          first rebuild with the current framework: only the named book directories if given, otherwise every book in the library
#   Which books the library includes, and in what order: library/books.txt (one per line; lines starting with # are comments); defaults to every directory containing book.js
# Output directory: env var OUT, defaults to <books-dir>/library/dist. Purely static, ready to deploy (GitHub Pages, serve.py library <port>).
set -euo pipefail
FW=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "${BOOKS_DIR:-$PWD}" && pwd)
export BOOKS_DIR=$ROOT
BUILD=0; rebuild=()
for a in "$@"; do if [ "$a" = "--build" ]; then BUILD=1; else rebuild+=("$a"); fi; done
books=()
if [ -f "$ROOT/library/books.txt" ]; then
  while read -r b; do [ -n "$b" ] && [ "${b#\#}" = "$b" ] && books+=("$b"); done < "$ROOT/library/books.txt"
fi
if [ ${#books[@]} -eq 0 ]; then for d in "$ROOT"/*/book.js; do books+=("$(basename "$(dirname "$d")")"); done; fi
if [ $BUILD -eq 1 ]; then
  if [ ${#rebuild[@]} -gt 0 ]; then "$FW/build-all.sh" "${rebuild[@]}"; else "$FW/build-all.sh" "${books[@]}"; fi
fi

OUT=${OUT:-$ROOT/library/dist}
rm -rf "$OUT"; mkdir -p "$OUT"
for b in "${books[@]}"; do
  [ -f "$ROOT/$b/dist/book.json" ] || { echo "✗ $b: missing $b/dist/book.json (build it first: build-all.sh $b)"; exit 1; }
  cp -r "$ROOT/$b/dist" "$OUT/$b"
  # Mark "this page is in a library" (pages use this to show a back-to-library button)
  find "$OUT/$b" -name index.html -exec sed -i 's|<head>|<head><meta name="book-library" content="1">|' {} +
done
cp "$FW/library/index.html" "$OUT/index.html"
touch "$OUT/.nojekyll"
python3 - "$OUT" "${books[@]}" <<'EOF'
import json, sys, os
out, books = sys.argv[1], sys.argv[2:]
lib = {"books": [json.load(open(os.path.join(out, b, "book.json"), encoding="utf-8")) for b in books]}
json.dump(lib, open(os.path.join(out, "library.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("Library: " + ", ".join(f"{x['title']} ({sum(c['ready'] for c in x['chapters'])}/{len(x['chapters'])})" for x in lib["books"]))
EOF
echo "→ $OUT"

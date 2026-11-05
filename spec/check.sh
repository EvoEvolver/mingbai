#!/usr/bin/env bash
# Single-chapter build + screenshot self-check. Usage: check.sh <chapterId> <BOOK_DIR>
# Outputs under /tmp/check-<book-dir-name>-<id>/: shot.png (full page), shot-modal.png (concept modal), and a JSON report (block list, console errors)
set -euo pipefail
ID=${1:?usage: check.sh <chapter-id> <book-dir>}; BOOK=$(cd "${2:?usage: check.sh <chapter-id> <book-dir>}" && pwd)
FW=$(cd "$(dirname "$0")/.." && pwd)
OUT=/tmp/check-$(basename "$BOOK")-$ID
rm -rf "$OUT"
# A syntax error in a data file imported directly by book.js (e.g. the per-chapter statement registries chapters/_*_stmts.js) stops the whole book from building: report it clearly first
for f in "$BOOK"/chapters/_*_stmts.js; do
  [ -f "$f" ] || continue
  node --check "$f" 2>/tmp/stmts-check.err || { echo "✗ Syntax error: $f (an error in a file imported by book.js stops the whole book from building)"; head -5 /tmp/stmts-check.err; exit 3; }
done
cd "$FW/app"
# Builds and screenshots both go through heavy.sh serially (global lock + memory check), so agents self-checking in parallel don't use a lot of memory at once
ONLY=$ID BOOK=$BOOK OUT=$OUT/site "$FW/tools/heavy.sh" npx vite build --logLevel error
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1])')
python3 -m http.server "$PORT" -d "$OUT/site" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 0.5
"$FW/tools/heavy.sh" node "$FW/tools/pw/shot.mjs" "http://localhost:$PORT/$ID/" "$OUT/shot.png"
echo "screenshots: $OUT/shot.png $OUT/shot-modal.png"

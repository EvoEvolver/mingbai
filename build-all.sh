#!/usr/bin/env bash
# Rebuild all (or the given) books with the current framework.
# Books directory: env var BOOKS_DIR, defaults to the current directory.
# Usage: build-all.sh                # build every directory under BOOKS_DIR that contains book.js
#       build-all.sh book-a book-b   #       build-all.sh book-a book-b   # build only the given books
set -uo pipefail
# Memory protection: cap the Node heap of each build process (one book peaks at about 0.9GB) and stop when available memory is low, to avoid triggering systemd-oomd
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${BUILD_HEAP_MB:-1536}"
MIN_AVAIL_MB=${MIN_AVAIL_MB:-2048}
avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
FW=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "${BOOKS_DIR:-$PWD}" && pwd)
cd "$FW/app"
books=("$@")
if [ ${#books[@]} -eq 0 ]; then for d in "$ROOT"/*/book.js; do books+=("$(basename "$(dirname "$d")")"); done; fi
fail=0
for b in "${books[@]}"; do
  if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then echo "⚠ Available memory $(avail_mb)MB < ${MIN_AVAIL_MB}MB, stopping build (remaining: $b and later)"; exit 2; fi
  if BOOK="$ROOT/$b" npx vite build --logLevel error >"/tmp/build-$b.log" 2>&1; then echo "✓ $b"; else echo "✗ $b (see /tmp/build-$b.log)"; fail=1; fi
done
exit $fail

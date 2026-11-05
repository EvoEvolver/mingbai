#!/usr/bin/env bash
# Run "heavy" commands (vite builds, Playwright/Chromium screenshots, etc.) serially, so multiple agents can't exhaust memory at once (this has triggered systemd-oomd before).
# Usage: tools/heavy.sh <command…>       e.g.: heavy.sh node tools/pw/el.mjs URL SEL OUT.png
# - Global file lock /tmp/books-heavy.lock: only one heavy command runs at a time, the rest queue
# - Before running, wait until available memory ≥ MIN_AVAIL_MB (default 2500)
# - Node heap limit BUILD_HEAP_MB (default 1536)
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${BUILD_HEAP_MB:-1536}"
MIN=${MIN_AVAIL_MB:-2500}
exec 9>/tmp/books-heavy.lock
flock 9
for i in $(seq 1 120); do
  avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  [ "$avail" -ge "$MIN" ] && break
  [ "$i" = 1 ] && echo "[heavy] Available memory ${avail}MB < ${MIN}MB, waiting…" >&2
  sleep 5
done
"$@"

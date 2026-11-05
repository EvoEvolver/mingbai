#!/usr/bin/env bash
# 用当前框架重新构建全部（或指定的）书。
# 书所在的目录：环境变量 BOOKS_DIR，缺省为当前目录。
# 用法: build-all.sh                # 构建 BOOKS_DIR 下所有含 book.js 的目录
#       build-all.sh book-a book-b   # 只构建指定的书
set -uo pipefail
# 内存保护：限制每个构建进程的 Node 堆（单本书构建峰值约 0.9GB），并在可用内存不足时停下，避免触发 systemd-oomd
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
  if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then echo "⚠ 可用内存 $(avail_mb)MB < ${MIN_AVAIL_MB}MB，停止构建（剩余：$b 及之后）"; exit 2; fi
  if BOOK="$ROOT/$b" npx vite build --logLevel error >"/tmp/build-$b.log" 2>&1; then echo "✓ $b"; else echo "✗ $b（见 /tmp/build-$b.log）"; fail=1; fi
done
exit $fail

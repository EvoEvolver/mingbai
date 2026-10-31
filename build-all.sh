#!/usr/bin/env bash
# 用当前框架重新构建全部（或指定的）书。改了框架后运行一次，所有线上站点同步更新（serve.py 直接提供 <书>/dist）。
# 用法: framework/build-all.sh            # 构建 books/ 下所有含 book.js 的目录
#       framework/build-all.sh oot cosmo   # 只构建指定的书
set -uo pipefail
export PATH=$HOME/.local/node/bin:$PATH
# 内存保护：限制每个构建进程的 Node 堆（单本书构建峰值约 0.9GB），并在可用内存不足时停下，避免触发 systemd-oomd
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${BUILD_HEAP_MB:-1536}"
MIN_AVAIL_MB=${MIN_AVAIL_MB:-2048}
avail_mb() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/framework/app"
books=("$@")
if [ ${#books[@]} -eq 0 ]; then for d in "$ROOT"/*/book.js; do books+=("$(basename "$(dirname "$d")")"); done; fi
fail=0
for b in "${books[@]}"; do
  if [ "$(avail_mb)" -lt "$MIN_AVAIL_MB" ]; then echo "⚠ 可用内存 $(avail_mb)MB < ${MIN_AVAIL_MB}MB，停止构建（剩余：$b 及之后）"; exit 2; fi
  if BOOK="$ROOT/$b" npx vite build --logLevel error >"/tmp/build-$b.log" 2>&1; then echo "✓ $b"; else echo "✗ $b（见 /tmp/build-$b.log）"; fail=1; fi
done
exit $fail

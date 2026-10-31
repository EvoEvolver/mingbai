#!/usr/bin/env bash
# 用当前框架重新构建全部（或指定的）书。改了框架后运行一次，所有线上站点同步更新（serve.py 直接提供 <书>/dist）。
# 用法: framework/build-all.sh            # 构建 books/ 下所有含 book.js 的目录
#       framework/build-all.sh oot cosmo   # 只构建指定的书
set -uo pipefail
export PATH=$HOME/.local/node/bin:$PATH
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT/framework/app"
books=("$@")
if [ ${#books[@]} -eq 0 ]; then for d in "$ROOT"/*/book.js; do books+=("$(basename "$(dirname "$d")")"); done; fi
fail=0
for b in "${books[@]}"; do
  if BOOK="$ROOT/$b" npx vite build --logLevel error >"/tmp/build-$b.log" 2>&1; then echo "✓ $b"; else echo "✗ $b（见 /tmp/build-$b.log）"; fail=1; fi
done
exit $fail

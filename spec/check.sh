#!/usr/bin/env bash
# 单章构建 + 截图自检。用法: check.sh <chapterId> [BOOK_DIR]
# 产出: /tmp/check-<id>/（非 oot 书为 /tmp/check-<书目录名>-<id>/）shot.png（整页长图）, shot-modal.png（概念弹窗）, 以及 JSON 报告（区块列表、控制台错误）
set -euo pipefail
ID=$1; BOOK=${2:-/home/zijian/books/oot}
export PATH=$HOME/.local/node/bin:$PATH
FW=$(cd "$(dirname "$0")/.." && pwd)
# 默认书（oot）输出到 /tmp/check-<id>；其他书输出到 /tmp/check-<书目录名>-<id>，避免并行冲突
if [ "$(basename "$BOOK")" = oot ]; then OUT=/tmp/check-$ID; else OUT=/tmp/check-$(basename "$BOOK")-$ID; fi
rm -rf "$OUT"
cd "$FW/app"
ONLY=$ID BOOK=$BOOK OUT=$OUT/site npx vite build --logLevel error
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1])')
python3 -m http.server "$PORT" -d "$OUT/site" >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 0.5
node "$FW/tools/pw/shot.mjs" "http://localhost:$PORT/$ID/" "$OUT/shot.png"
echo "screenshots: $OUT/shot.png $OUT/shot-modal.png"

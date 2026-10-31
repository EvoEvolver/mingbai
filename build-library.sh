#!/usr/bin/env bash
# 组装书库：把各书的构建产物放进同一个静态站点。
#   <OUT>/index.html          书库首页（framework/library/index.html）
#   <OUT>/library.json        书目汇总（由各书 dist/book.json 合并）
#   <OUT>/<书>/…              各书站点（原样复制自 <书>/dist）
# 用法: framework/build-library.sh [--build [书目录名…]]
#   --build          先用当前框架重新构建：给出书目录名则只构建这些书，否则构建书库中的全部书
#   书库收录哪些书、按什么顺序：library/books.txt（每行一个；# 开头为注释），缺省为所有含 book.js 的目录
# 输出目录：环境变量 OUT，缺省 <仓库>/library/dist。纯静态，可直接部署（GitHub Pages、serve.py library <端口>）。
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD=0; rebuild=()
for a in "$@"; do if [ "$a" = "--build" ]; then BUILD=1; else rebuild+=("$a"); fi; done
books=()
if [ -f "$ROOT/library/books.txt" ]; then
  while read -r b; do [ -n "$b" ] && [ "${b#\#}" = "$b" ] && books+=("$b"); done < "$ROOT/library/books.txt"
fi
if [ ${#books[@]} -eq 0 ]; then for d in "$ROOT"/*/book.js; do books+=("$(basename "$(dirname "$d")")"); done; fi
if [ $BUILD -eq 1 ]; then
  if [ ${#rebuild[@]} -gt 0 ]; then "$ROOT/framework/build-all.sh" "${rebuild[@]}"; else "$ROOT/framework/build-all.sh" "${books[@]}"; fi
fi

OUT=${OUT:-$ROOT/library/dist}
rm -rf "$OUT"; mkdir -p "$OUT"
for b in "${books[@]}"; do
  [ -f "$ROOT/$b/dist/book.json" ] || { echo "✗ $b：缺少 $b/dist/book.json（请先构建：framework/build-all.sh $b）"; exit 1; }
  cp -r "$ROOT/$b/dist" "$OUT/$b"
  # 标记"本页位于书库中"（页面据此显示返回书库的按钮）
  find "$OUT/$b" -name index.html -exec sed -i 's|<head>|<head><meta name="book-library" content="1">|' {} +
done
cp "$ROOT/framework/library/index.html" "$OUT/index.html"
touch "$OUT/.nojekyll"
python3 - "$OUT" "${books[@]}" <<'EOF'
import json, sys, os
out, books = sys.argv[1], sys.argv[2:]
lib = {"books": [json.load(open(os.path.join(out, b, "book.json"), encoding="utf-8")) for b in books]}
json.dump(lib, open(os.path.join(out, "library.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("书库：" + "、".join(f"{x['title']}（{sum(c['ready'] for c in x['chapters'])}/{len(x['chapters'])}）" for x in lib["books"]))
EOF
echo "→ $OUT"

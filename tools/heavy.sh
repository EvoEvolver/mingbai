#!/usr/bin/env bash
# 串行执行"重"命令（vite 构建、Playwright/Chromium 截图等），防止多个 agent 同时跑把内存压爆（曾触发 systemd-oomd）。
# 用法: tools/heavy.sh <命令…>       例: heavy.sh node tools/pw/el.mjs URL SEL OUT.png
# - 全局文件锁 /tmp/books-heavy.lock：同一时刻只运行一个重命令，其余排队
# - 运行前等待可用内存 ≥ MIN_AVAIL_MB（默认 2500）
# - Node 堆上限 BUILD_HEAP_MB（默认 1536）
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=${BUILD_HEAP_MB:-1536}"
MIN=${MIN_AVAIL_MB:-2500}
exec 9>/tmp/books-heavy.lock
flock 9
for i in $(seq 1 120); do
  avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  [ "$avail" -ge "$MIN" ] && break
  [ "$i" = 1 ] && echo "[heavy] 可用内存 ${avail}MB < ${MIN}MB，等待…" >&2
  sleep 5
done
"$@"

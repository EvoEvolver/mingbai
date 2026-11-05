import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const pages = ["ch04", "ch05", "ch05b", "ch06", "ch07", "ch07b", "ch08", "ch08b", "ch11b"];
for (const id of pages) {
  await p.goto(`http://localhost:8940/icfab/${id}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  // 逐段滚动，触发懒加载的 3D 场景
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  const n = await p.locator("canvas").count();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const c = p.locator("canvas").nth(i);
    const gl = await c.evaluate(el => !!(el.__r3f || el.getContext && (el.dataset.engine || "").includes("three") || el.getAttribute("data-engine")));
    const box = await c.boundingBox(); if (!box || box.width < 250 || box.height < 180) continue;
    await c.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    // 截取包含画布与标题/控件的外层容器
    const host = c.locator("xpath=ancestor::*[self::figure or contains(@class,'tb-fig') or contains(@class,'fig') or contains(@class,'demo') or contains(@class,'card')][1]");
    const tgt = (await host.count()) ? host : c;
    const hb = await tgt.boundingBox(); if (hb.height > 1600) { await c.screenshot({ path: `/tmp/xhs/raw/icfab-${id}-${k++}.png` }); continue; }
    await tgt.screenshot({ path: `/tmp/xhs/raw/icfab-${id}-${k++}.png` });
  }
  console.log(id, "canvases", n, "shots", k);
}
await b.close();

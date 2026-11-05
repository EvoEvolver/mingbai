// 截图 + 收集控制台错误 + 基础交互冒烟测试。用法: node shot.mjs URL OUT.png
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push("console: " + m.text()));
p.on("response", r => r.status() >= 400 && errs.push(`HTTP ${r.status()}: ${r.url()}`));   // 失败的资源请求（含滚动时懒加载的插图）带 URL 报告
await p.goto(url, { waitUntil: "networkidle" });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
await p.screenshot({ path: out, fullPage: true });
// 展开所有折叠内容（推导、Details、证明、习题提示/解答），让 texErrors / symMiss 覆盖它们
await p.evaluate(async () => {
  const click = sel => document.querySelectorAll(sel).forEach(e => e.click());
  click(".tb-deriv:not(.open) .tb-deriv-h"); click(".tb-details:not(.open) .tb-details-h"); click(".proof:not(.open) .proof-h");
  await new Promise(r => setTimeout(r, 200));
  document.querySelectorAll(".tb-ex-tools button").forEach(b => { if (!/收起/.test(b.textContent)) b.click(); });
  await new Promise(r => setTimeout(r, 400));
});
const info = await p.evaluate(() => ({
  blocks: [...document.querySelectorAll("section.block")].map(s => s.id || "(no id)"),
  concepts: document.querySelectorAll(".ccard").length, height: document.body.scrollHeight,
  texErrors: [...document.querySelectorAll(".tex-error")].slice(0, 20).map(e => e.textContent.slice(0, 80) + "  ⟵ " + (e.title || "").slice(0, 100)),
  equations: document.querySelectorAll(".eq[id]").length, figures: document.querySelectorAll(".tb-fig").length,
  symbols: document.querySelectorAll("[data-sym]").length,
  symMiss: window.__symMiss ? [...window.__symMiss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${k}×${v}`) : undefined,
}));
if (info.concepts) {  // 打开第一张概念卡
  await p.click(".ccard"); await p.waitForTimeout(250);
  await p.screenshot({ path: out.replace(/\.png$/, "-modal.png") });
  await p.keyboard.press("Escape");
}
console.log(JSON.stringify({ ...info, errors: errs }, null, 1));
await b.close();

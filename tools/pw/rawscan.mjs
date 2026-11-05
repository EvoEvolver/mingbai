// 扫描页面上 KaTeX 之外残留的 $…$ / \命令 / Unicode 数学（含逐个打开的概念卡弹窗各标签页）。用法: node rawscan.mjs BASEURL id1,id2,...
import { chromium } from "playwright";
const [base, ids] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const scan = () => p.evaluate(() => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (n.parentElement.closest(".katex, script, style, svg, .tex-error")) continue;
    const t = n.textContent; if (/\$[^$\s][^$]*\$|\\[a-zA-Z]{2,}|[ℓ√⌈⌉⊗𝒥𝓛ℚ𝔽⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(t)) out.push(t.trim().slice(0, 90));
  }
  return [...new Set(out)];
});
for (const id of ids.split(",")) {
  await p.goto(`${base}${id}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(300);
  let hits = await scan();
  const n = await p.locator(".ccard").count();
  for (let i = 0; i < n; i++) {
    await p.locator(".ccard").nth(i).click(); await p.waitForTimeout(120);
    const tabs = await p.locator("#modal .tabs button").count();
    for (let t = 0; t < tabs; t++) { await p.locator("#modal .tabs button").nth(t).click(); await p.waitForTimeout(60); hits.push(...await scan()); }
    await p.keyboard.press("Escape");
  }
  hits = [...new Set(hits)];
  console.log(`${id}: ${hits.length}`); hits.slice(0, 25).forEach(h => console.log("   ", h));
}
await b.close();

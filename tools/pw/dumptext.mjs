// 回归对比：逐章导出 main 的 innerText 与 KaTeX 节点数。用法: node dumptext.mjs BASEURL id1,id2,... OUT.json
import { chromium } from "playwright";
import fs from "node:fs";
const [base, ids, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const res = {};
for (const id of ids.split(",")) {
  await p.goto(`${base}${id}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(300);
  res[id] = await p.evaluate(() => ({ text: document.querySelector("main")?.innerText || "", katex: document.querySelectorAll(".katex").length, errs: document.querySelectorAll(".tex-error").length }));
}
fs.writeFileSync(out, JSON.stringify(res)); await b.close();

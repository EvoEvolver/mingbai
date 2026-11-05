// Viewport screenshot (including the fixed top bar). Usage: node vp.mjs URL SELECTOR OUT.png
import { chromium } from "playwright";
const [url, sel, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
if (sel !== "-") { await p.locator(sel).first().evaluate(e => e.scrollIntoView({ block: "start" })); await p.mouse.wheel(0, -60); }
await p.waitForTimeout(800); await p.screenshot({ path: out }); await b.close();

// Element screenshot. Usage: node el.mjs URL SELECTOR OUT.png
import { chromium } from "playwright";
const [url, sel, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(url, { waitUntil: "networkidle" });
const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
await el.screenshot({ path: out }); await b.close();

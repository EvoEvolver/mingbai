// Screenshot + console error collection + basic interaction smoke test. Usage: node shot.mjs URL OUT.png
import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("pageerror", e => errs.push("pageerror: " + e.message));
p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push("console: " + m.text()));
p.on("response", r => r.status() >= 400 && errs.push(`HTTP ${r.status()}: ${r.url()}`));   // Report failed resource requests (including figures lazily loaded on scroll) with their URL
await p.goto(url, { waitUntil: "networkidle" });
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
await p.screenshot({ path: out, fullPage: true });
// Expand all collapsed content (derivations, Details, proofs, exercise hints/solutions) so texErrors / symMiss cover it
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
if (info.concepts) {  // Open the first concept card
  await p.click(".ccard"); await p.waitForTimeout(250);
  await p.screenshot({ path: out.replace(/\.png$/, "-modal.png") });
  await p.keyboard.press("Escape");
}
console.log(JSON.stringify({ ...info, errors: errs }, null, 1));
await b.close();

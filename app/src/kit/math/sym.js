// Symbol dictionary and automatic LaTeX annotation.
// Given a symbol table (from each chapter's notation), wraps symbol bases found in formula source with \htmlData{sym=<id>}{…},
// so they can be clicked after rendering to look up their definition. Sub/superscripts stay on the original base, leaving the typesetting unchanged.
//
// Recognition rules:
//  - base = single Latin letter | Greek letter control word (\eta, \Omega…) | modifier command + argument (\dot a, \tilde{x}, \mathcal{H}, \boldsymbol{k}…)
//  - If a subscript directly follows the base, first look up "base|subscript" (e.g. T|\nu, \Omega|m, d|A), then fall back to "base|"
//  - Content inside sub/superscripts and text environments such as \mathrm{…}/\text{…}/\rm isn't matched (it's indices or units)
//  - If a modified base isn't found, fall back to the modified letter (\dot a → a)
//  - Authors can force a symbol with \sym{id}{…} or suppress one with \nosym{…}
// Greek/Latin letters not in the dictionary count toward missStats (used by the self-check report).

const GREEK = new Set(("alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho " +
  "sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega ell hbar").split(" "));
const ACCENT = new Set(["dot", "ddot", "hat", "bar", "tilde", "vec", "widetilde", "widehat", "overline", "boldsymbol", "mathcal", "mathbf", "bm", "mathscr", "mathbb", "breve", "check"]);
const SKIP1 = new Set(["mathrm", "text", "textrm", "textit", "textbf", "textsf", "mathsf", "mathit", "operatorname", "tag", "label", "begin", "end",
  "hspace", "vspace", "mbox", "color", "htmlData", "htmlClass", "htmlId", "htmlStyle", "textcolor", "href", "url"]);
const SWITCH = new Set(["rm", "it", "bf", "sf", "tt"]);       // applies until the end of the enclosing group
const IGNORE = new Set(["d", "e", "\\pi"]);                          // differential d and Euler's number e don't count as missing by default

export const missStats = new Map();
if (typeof window !== "undefined") window.__symMiss = missStats;

function tokenize(s) {
  const t = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      let j = i + 1;
      if (/[a-zA-Z]/.test(s[j] || "")) { while (j < s.length && /[a-zA-Z]/.test(s[j])) j++; t.push({ k: "cw", v: s.slice(i + 1, j), raw: s.slice(i, j) }); i = j; }
      else { t.push({ k: "cs", v: s[j], raw: s.slice(i, j + 1) }); i = j + 1; }
    } else if (/\s/.test(c)) { let j = i; while (j < s.length && /\s/.test(s[j])) j++; t.push({ k: "sp", raw: s.slice(i, j) }); i = j; }
    else t.push({ k: c === "{" ? "open" : c === "}" ? "close" : c === "^" ? "sup" : c === "_" ? "sub" : /[a-zA-Z]/.test(c) ? "let" : "ch", v: c, raw: c }), i++;
  }
  return t;
}
function matchClose(t, i) { let d = 0; for (let j = i; j < t.length; j++) { if (t[j].k === "open") d++; else if (t[j].k === "close" && --d === 0) return j; } return t.length - 1; }
const skipSp = (t, j) => { while (j < t.length && t[j].k === "sp") j++; return j; };
// Argument range [a, b): a braced group or a single token
function arg(t, j) { j = skipSp(t, j); if (j >= t.length) return [j, j]; return t[j].k === "open" ? [j, matchClose(t, j) + 1] : [j, j + 1]; }
const raw = (t, a, b) => t.slice(a, b).map(x => x.raw).join("");
export const norm = s => String(s).replace(/\\(mathrm|rm|text|textrm|mathit|it)\b/g, "").replace(/[{}\s]/g, "");

// Parse a dictionary entry's sym (e.g. "T_\nu", "\Omega_{\rm m}", "\dot a", "\mathcal{H}") → lookup key
export function symKey(tex) {
  const t = tokenize(tex); let i = skipSp(t, 0), base = null, j = i + 1;
  const x = t[i]; if (!x) return null;
  if (x.k === "cw" && ACCENT.has(x.v)) { const [a, b] = arg(t, i + 1); base = `\\${x.v}{${norm(raw(t, a, b))}}`; j = b; }
  else if (x.k === "cw") base = "\\" + x.v;
  else base = x.v;
  j = skipSp(t, j);
  let sub = "";
  if (t[j]?.k === "sub") { const [a, b] = arg(t, j + 1); sub = norm(raw(t, a, b)); }
  return base + "|" + sub;
}

// Build the lookup: entries = [{id, sym, …}], earlier entries win (this chapter's entries go first)
export function buildTable(entries, expand = s => s) {
  const map = new Map();
  for (const e of entries) { const k = symKey(expand(e.sym)); if (k && !map.has(k)) map.set(k, e); }
  return map;
}

// Annotate: returns {tex: annotated source, used: Set(id)}
export function annotate(src, table) {
  const t = tokenize(src), used = new Set();
  let out = "", i = 0, nextSkip = false, nextScript = false;
  const stack = [{ skip: false, script: false }];
  const top = () => stack[stack.length - 1];
  while (i < t.length) {
    const x = t[i], f = top();
    if (x.k === "sub" || x.k === "sup") {
      const j0 = i + 1; i = skipSp(t, j0); out += x.raw + raw(t, j0, i);
      if (i < t.length && t[i].k !== "open") { // single-token sub/superscript: output as is
        if (t[i].k === "cw" && ACCENT.has(t[i].v)) { const [, b] = arg(t, i + 1); out += raw(t, i, b); i = b; }
        else { out += t[i].raw; i++; }
      } else nextScript = true;
      continue;
    }
    if (x.k === "open") { stack.push({ skip: f.skip || nextSkip, script: f.script || nextScript }); nextSkip = nextScript = false; out += x.raw; i++; continue; }
    if (x.k === "close") { if (stack.length > 1) stack.pop(); out += x.raw; i++; continue; }
    if (x.k === "cw") {
      if (x.v === "sym" || x.v === "nosym") {         // \sym{id}{…} / \nosym{…}
        if (x.v === "sym") {
          const [a, b] = arg(t, i + 1), id = norm(raw(t, a, b)), [c, d] = arg(t, b);
          const inner = raw(t, c, d); const body = t[c]?.k === "open" ? inner.slice(1, -1) : inner;
          out += `{\\htmlData{sym=${id}}{${body}}}`; used.add(id); i = d;
        } else { const [a, b] = arg(t, i + 1); out += raw(t, a, b); i = b; }
        continue;
      }
      if (SWITCH.has(x.v)) { f.skip = true; out += x.raw; i++; continue; }
      if (SKIP1.has(x.v)) { const [a, b] = arg(t, i + 1); out += x.raw + raw(t, i + 1, b); i = b; if (["color", "textcolor", "htmlData", "htmlClass", "htmlId", "htmlStyle", "href"].includes(x.v)) { /* the second argument is processed normally */ } continue; }
    }
    // Candidate base
    let base = null, key = null, inner = null, j = i + 1, isLetter = false;
    if (!f.skip && !f.script) {
      if (x.k === "cw" && ACCENT.has(x.v)) {
        const [a, b] = arg(t, i + 1); base = raw(t, i, b); j = b;
        let argText = raw(t, a, b).trim();
        if (t[a]?.k === "open") argText = argText.slice(1, -1).trim();          // strip the argument's outer braces
        const m = argText.match(/^\\sym\{([^{}]*)\}\{([\s\S]*)\}$/);         // \hat{\sym{id}{p}}: annotate the whole modified symbol with the given id
        if (m) { const id = norm(m[1]); out += `{\\htmlData{sym=${id}}{\\${x.v}{${m[2]}}}}`; used.add(id); i = j; continue; }
        inner = norm(raw(t, a, b)); key = `\\${x.v}{${inner}}`;
      }
      else if (x.k === "cw" && GREEK.has(x.v)) { base = x.raw; key = "\\" + x.v; isLetter = true; }
      else if (x.k === "let") { base = x.raw; key = x.v; isLetter = true; }
    }
    if (!base) { out += x.raw; i++; continue; }
    const k = skipSp(t, j); let sub = "";
    if (t[k]?.k === "sub") { const [a, b] = arg(t, k + 1); sub = norm(raw(t, a, b)); }
    let e = table.get(key + "|" + sub) || table.get(key + "|");
    if (!e && inner) e = table.get(inner + "|" + sub) || table.get(inner + "|") || table.get("\\" + inner + "|");
    if (e) { out += `{\\htmlData{sym=${e.id}}{${base}}}`; used.add(e.id); }   // extra braces: compatible with brace-less arguments like \frac2r
    else {
      out += base;
      if ((isLetter || inner) && !IGNORE.has(key)) { const mk = key + (sub ? "_" + sub : ""); missStats.set(mk, (missStats.get(mk) || 0) + 1); }
    }
    i = j;
  }
  return { tex: out, used };
}

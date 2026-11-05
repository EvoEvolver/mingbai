import { t } from "../i18n/index.js";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { renderTex, TxI, Tx, EqLine, anchor, useRegisterEq } from "./tex.jsx";
import { drawInk } from "./ink.js";

// FormulaMap: draws a formula's structure tree as a treemap. Nesting = structure, leaf area ∝ importance.
// The formula is generated from the tree, and the tree is the single source of truth, so every symbol in the formula necessarily belongs to some node.
//
// tree: { id, tex, kids?, w?, name, label, note?, role?, glyph? }
//   tex   this node's TeX, with #childId placeholders, e.g. "#lhs = #rhs", "\sqrt{#S/#N}"; symbols not belonging to any child (=, √, ∑) belong to this node.
//   kids  child nodes; must match the placeholders in tex one to one, otherwise an error is thrown. The root is usually a relation (= or ≈), with the two sides as children.
//   w     leaf importance, proportional to its area; a parent's area follows from its children (plus the title bar) and isn't specified.
//   glyph symbol shown in the parent's title, defaults to tex (children shown as □); needed for nodes with no visible symbol such as implicit multiplication, e.g. "\times".
// With `n` it is a numbered equation and can replace <Eq>: it registers the formula (for \\eqref, hover previews, and KeyEquations)
// and provides the eq-<n> anchor. `keyEq`, `title`, and `say` mean the same as on <Eq>. Define `tree` at module level so it stays stable.
// `height` is the starting height and `maxHeight` the inline cap. A formula too dense for the cap can open in a full panel,
// which shares the selection and has the room to show every node at a readable size.
// Hover and highlight change classes directly, without React re-renders.

const SLOT = /(?<!\\)#([A-Za-z][A-Za-z0-9]*)/g;   // ids are alphanumeric only, so #lam_{…} and #a-#b aren't misread
const HEAD = 26, PAD = 3, MIN_W = 52, MIN_H = 36;
const glyph = t => renderTex(`\\nosym{${t || ""}}`);   // cells are display only, so no symbol annotation

// Validate the tree and expand it: plain is the full TeX, marked has \htmlClass (for linking to the source formula), anc/desc are ancestors and descendants
function compile(tree) {
  const nodes = {};
  const walk = (n, parent) => {
    if (nodes[n.id]) throw new Error(`FormulaMap: duplicate node id: ${n.id}`);
    const kids = n.kids || [], slots = [...n.tex.matchAll(SLOT)].map(m => m[1]), ids = kids.map(k => k.id);
    const bad = [...slots.filter(s => !ids.includes(s)), ...ids.filter(i => slots.filter(s => s === i).length !== 1)];
    if (bad.length) throw new Error(`FormulaMap: tex placeholders of node ${n.id} don't match kids: ${bad.join(", ")}`);
    const c = nodes[n.id] = { ...n, kids, parent, anc: parent ? [parent, ...nodes[parent].anc] : [], desc: [] };
    kids.forEach(k => { walk(k, n.id); c.desc.push(k.id, ...nodes[k.id].desc); });
    const fill = f => n.tex.replace(SLOT, (_, id) => `{${nodes[id][f]}}`);
    c.plain = fill("plain");
    c.marked = `\\htmlClass{flm flm-${n.id}}{${fill("marked")}}`;
    c.total = kids.length ? kids.reduce((s, k) => s + nodes[k.id].total, 0) : n.w || 1;
    c.head = n.glyph || n.tex.replace(SLOT, "\\htmlClass{fm-hole}{\\square}");
  };
  walk(tree, null);
  return nodes;
}

// Squarified treemap: lays items (with value) out in rectangle r, returns [{id, x, y, w, h}]
function squarify(items, r) {
  const out = [], total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length || total <= 0) return out;
  const scale = (r.w * r.h) / total;
  let rest = items.map(i => ({ ...i, a: i.value * scale })).sort((a, b) => b.a - a.a), rect = { ...r };
  const worst = (row, side) => { const s = row.reduce((t, x) => t + x.a, 0), mx = Math.max(...row.map(x => x.a)), mn = Math.min(...row.map(x => x.a)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  while (rest.length) {
    const side = Math.min(rect.w, rect.h); let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) { row.push(rest[i]); i++; }
    const s = row.reduce((t, x) => t + x.a, 0);
    if (rect.w >= rect.h) { const cw = s / rect.h; let y = rect.y; row.forEach(x => { const h = x.a / cw; out.push({ id: x.id, x: rect.x, y, w: cw, h }); y += h; }); rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h }; }
    else { const ch = s / rect.w; let x0 = rect.x; row.forEach(x => { const w = x.a / ch; out.push({ id: x.id, x: x0, y: rect.y, w, h: ch }); x0 += w; }); rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch }; }
    rest = rest.slice(i);
  }
  return out;
}

const inner = r => ({ x: r.x + PAD, y: r.y + HEAD, w: Math.max(0, r.w - 2 * PAD), h: Math.max(0, r.h - HEAD - PAD) });

// One layout pass for a given total size. Title bars and margins also take up area: convert them to weight and iterate a few times, so leaf area is truly proportional to w.
function layoutAt(nodes, rootId, W, H) {
  const root = nodes[rootId], over = {};
  let rects = {};
  for (let pass = 0; pass < 5; pass++) {
    const value = id => { const n = nodes[id]; return n.kids.length ? n.kids.reduce((s, k) => s + value(k.id), 0) + (over[id] || 0) : n.w || 1; };
    rects = { [rootId]: { x: 0, y: 0, w: W, h: H } };
    const rec = id => {
      const n = nodes[id]; if (!n.kids.length) return;
      for (const t of squarify(n.kids.map(k => ({ id: k.id, value: value(k.id) })), inner(rects[id]))) { rects[t.id] = t; rec(t.id); }
    };
    rec(rootId);
    const parents = Object.keys(nodes).filter(id => id !== rootId && nodes[id].kids.length);
    const cost = id => { const r = rects[id], i = inner(r); return r.w * r.h - i.w * i.h; };
    const rootIn = inner(rects[rootId]);
    const perWeight = Math.max(1, (rootIn.w * rootIn.h - parents.reduce((s, id) => s + cost(id), 0)) / root.total);
    parents.forEach(id => { over[id] = cost(id) / perWeight; });
  }
  return rects;
}

// Grow taller up to maxH while leaves don't fit. Past that the leaves just get smaller: no node is ever dropped.
function layoutTree(nodes, rootId, W, minH, maxH) {
  const leaves = Object.keys(nodes).filter(id => !nodes[id].kids.length);
  for (let H = minH; ; H = Math.min(maxH, Math.ceil(H * 1.12))) {
    const rects = layoutAt(nodes, rootId, W, H);
    const fits = leaves.every(id => rects[id].w >= MIN_W && rects[id].h >= MIN_H);
    if (fits || H >= maxH) return { rects, H, fits };
  }
}

// Scale the formula to fit its cell (changes styles directly, without a re-render)
function FitGlyph({ tex, fs, maxW, maxH }) {
  const ref = useRef(null);
  const html = useMemo(() => glyph(tex), [tex]);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    let live = true;
    const fit = () => {
      if (!live) return;
      el.style.fontSize = fs + "px";
      const r = el.firstElementChild?.getBoundingClientRect(); if (!r?.width) return;
      el.style.fontSize = fs * Math.min(1, maxW / r.width, Math.max(12, maxH) / r.height) + "px";
    };
    fit(); document.fonts?.ready.then(fit);
    return () => { live = false; };
  }, [html, fs, maxW, maxH]);
  return <div className="fm-g" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Cell({ id, nodes, rects, origin, maxFs }) {
  const n = nodes[id], r = rects[id], area = r.w * r.h, style = { left: r.x - origin.x, top: r.y - origin.y, width: r.w, height: r.h };
  if (n.kids.length) {
    return (
      <div className={"fm-cell par" + (n.parent ? "" : " root")} data-id={id} data-role={n.role || "const"} style={style}>
        <div className="fm-head" data-hit={id} tabIndex={0} role="button" title={n.name}>
          <span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(n.head) }} /><code>{n.name}</code><span className="fm-l"><TxI>{n.label}</TxI></span>
        </div>
        {n.kids.map(k => <Cell key={k.id} id={k.id} nodes={nodes} rects={rects} origin={r} maxFs={maxFs} />)}
      </div>);
  }
  const fs = Math.max(13, Math.min(maxFs, Math.sqrt(area) / 4.2));
  const showCode = r.h >= 120 && r.w >= 110, showLab = r.h >= 62 && r.w >= 90, longLab = area > 26000;
  return (
    <div className="fm-cell leaf" data-id={id} data-hit={id} data-role={n.role || "const"} style={style} tabIndex={0} role="button" title={n.name}>
      <div className="fm-body">
        <FitGlyph tex={n.plain} fs={fs} maxW={r.w - 20} maxH={r.h - 8 - (showCode ? 24 : 0) - (showLab ? (longLab ? 44 : 22) : 0)} />
        {showCode && <code>{n.name}</code>}
        {showLab && <div className={"fm-l" + (longLab ? "" : " one")}><TxI>{n.label}</TxI></div>}
      </div>
    </div>);
}

// The formula, map, and notes. Rendered inline and again in the panel; `sel` is shared between the two.
function FormulaView({ nodes, rootId, n, title, say, sel, height, maxHeight, panel, onExpand, onClose }) {
  const box = useRef(null), eqRef = useRef(null), detail = useRef(null), root = useRef(null), hover = useRef(null);
  const [size, setSize] = useState({ w: 760, h: 0 });
  useLayoutEffect(() => {
    const update = () => setSize({ w: box.current.clientWidth || 760, h: box.current.clientHeight });
    update();
    const ro = new ResizeObserver(update); ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  // Inline: from `height` up to the cap. Panel: fill the space, and scroll only if the leaves still don't fit.
  const minH = panel ? Math.max(size.h, 200) : Math.min(height, maxHeight), maxH = panel ? minH * 3 : maxHeight;
  const { rects, H, fits } = useMemo(() => layoutTree(nodes, rootId, size.w, minH, maxH), [nodes, rootId, size.w, minH, maxH]);

  // Paint the current state to the DOM. lit: the hovered item if any, otherwise the selected one; unrelated blocks fade only on hover, so the view stays clean at rest.
  const paint = useCallback(() => {
    const lit = hover.current ?? sel.current, h = hover.current, on = lit && nodes[lit];
    const rel = h ? new Set([h, ...nodes[h].anc, ...nodes[h].desc]) : null;
    root.current?.querySelectorAll(".fm-cell").forEach(el => {
      const id = el.dataset.id;
      el.classList.toggle("on", id === lit);
      el.classList.toggle("sel", id === sel.current);
      el.classList.toggle("path", !!on && on.anc.includes(id));
      el.classList.toggle("fm-dim", !!rel && !rel.has(id));
    });
    const E = eqRef.current;
    if (E) {
      E.querySelectorAll(".flm").forEach(el => {
        const id = [...el.classList].find(c => c.startsWith("flm-"))?.slice(4);
        if (nodes[id]) el.dataset.role = nodes[id].role || "const";
        el.classList.toggle("fm-on", id === lit);
      });
      E.classList.toggle("fm-focus", !!h);
      drawInk(E.querySelector(".eqline-m"), lit ? [...E.querySelectorAll(".flm-" + lit)] : []);
    }
    detail.current?.querySelectorAll(".fm-card").forEach(el => el.classList.toggle("show", el.dataset.id === (lit || "")));
  }, [nodes, sel]);
  useLayoutEffect(paint);
  useLayoutEffect(() => { let live = true; document.fonts?.ready.then(() => live && paint()); return () => { live = false; }; }, [paint]);   // glyph positions change once the KaTeX fonts load

  const setHover = id => { if (hover.current !== id) { hover.current = id; paint(); } };
  const select = id => { sel.current = sel.current === id ? null : id; paint(); };
  const hitOf = e => e.target.closest?.("[data-hit]")?.dataset.hit;
  const flmOf = e => { const el = e.target.closest?.(".flm"); return el && [...el.classList].find(c => c.startsWith("flm-"))?.slice(4); };

  return <>
    <div className="fm-bar">
      {title && <b><TxI>{title}</TxI></b>}
      <span className="fm-hint">{t("fm.hint")}</span>
      {panel
        ? <button className="fm-btn" onClick={onClose} autoFocus aria-label={t("ui.close")}>×</button>
        : <button className={"fm-btn" + (fits ? "" : " tight")} onClick={onExpand}>{t("fm.expand")}</button>}
    </div>
    {say && <div className="fm-say"><TxI>{say}</TxI></div>}
    <div className="fm-eq" ref={eqRef}
      onMouseOver={e => { const id = flmOf(e); if (id && nodes[id]) setHover(id); }} onMouseLeave={() => setHover(null)}
      onClick={e => { const id = flmOf(e); if (id && nodes[id]) select(id); }}>
      <EqLine tex={nodes[rootId].marked} n={n} min={0.42} />
    </div>
    <div className="fm-main">
      <div className="fm-scroll" ref={box}>
        {/* Only leaves and parent title bars respond to hover: moving across gaps between blocks changes nothing, so there's no flicker */}
        <div className="fm-map" ref={root} style={{ height: H }}
          onMouseOver={e => { const id = hitOf(e); if (id) setHover(id); }} onMouseLeave={() => setHover(null)}
          onFocus={e => { const id = hitOf(e); if (id) setHover(id); }} onBlur={() => setHover(null)}
          onClick={e => { const id = hitOf(e); if (id) select(id); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { const id = hitOf(e); if (id) { e.preventDefault(); select(id); } } }}>
          <Cell id={rootId} nodes={nodes} rects={rects} origin={{ x: 0, y: 0 }} maxFs={panel ? 56 : 44} />
        </div>
      </div>
      {/* All notes stack in one grid cell, with height set by the longest: content below doesn't jump on switching */}
      <div className="fm-detail" ref={detail} onClick={e => { const id = e.target.closest?.("[data-crumb]")?.dataset.crumb; if (id) select(id); }}>
        <div className="fm-card fm-empty" data-id="">{t("fm.empty")}</div>
        {Object.values(nodes).map(x => (
          <div key={x.id} className="fm-card" data-id={x.id} data-role={x.role || "const"}>
            <div className="fm-crumbs">{[...x.anc].reverse().map(a => <button key={a} data-crumb={a} dangerouslySetInnerHTML={{ __html: glyph(nodes[a].head) + " ›" }} />)}</div>
            <div className="fm-dh"><span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(x.plain) }} /><code>{x.name}</code><b><TxI>{x.label}</TxI></b></div>
            {x.note && <Tx>{x.note}</Tx>}
          </div>))}
      </div>
    </div>
    <div className="fm-legend">{[...new Set(Object.values(nodes).map(x => x.role || "const"))].map(r => <span key={r} data-role={r}><i />{t("fm.role")[r]}</span>)}</div>
  </>;
}

function FormulaPanel({ onClose, children }) {
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Escape closes a symbol popover or equation modal first, if one is open over the panel
    const onKey = e => { if (e.key === "Escape" && !document.querySelector(".sym-pop, .tb-modal")) onClose(); };
    addEventListener("keydown", onKey, true);   // capture: check before the popover's own handler removes it
    return () => { document.body.style.overflow = overflow; removeEventListener("keydown", onKey, true); };
  }, [onClose]);
  // A reference link in a note jumps within the page underneath, so the panel gets out of the way
  return createPortal(
    <div className="fm-overlay" onClick={e => { if (e.target === e.currentTarget || e.target.closest("a[href]")) onClose(); }}>
      <div className="fm fm-panel" role="dialog" aria-modal="true">{children}</div>
    </div>, document.body);
}

export function FormulaMap({ n, title, tree, height = 460, maxHeight = 520, start, keyEq = false, say }) {
  const nodes = useMemo(() => compile(tree), [tree]);
  useRegisterEq(n, nodes[tree.id].plain, { keyEq, title, say });
  const sel = useRef(start || null);
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  const close = useCallback(() => { setOpen(false); opener.current?.focus({ preventScroll: true }); }, []);
  const view = { nodes, rootId: tree.id, n, title, say, sel };
  return (
    <figure className="fm" id={n ? anchor("eq", n) : undefined}>
      <FormulaView {...view} height={height} maxHeight={maxHeight} onExpand={e => { opener.current = e.currentTarget; setOpen(true); }} />
      {open && <FormulaPanel onClose={close}><FormulaView {...view} panel onClose={close} /></FormulaPanel>}
    </figure>);
}

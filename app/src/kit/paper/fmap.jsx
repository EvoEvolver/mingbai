import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { renderTex, TxI, Tx } from "../math/tex.jsx";
import { LENS_ROLES } from "./lens.jsx";

// 公式树图（FormulaMap）：公式的结构树画成 treemap。嵌套 = 结构，叶子面积 ∝ 重要性。
// 公式由树生成，树是唯一数据源，所以公式里的每个记号都必然属于某个节点。
//
// tree: { id, tex, kids?, w?, name, label, note?, role?, glyph? }
//   tex   本节点的 TeX，用 #子节点id 占位，如 "#lhs = #rhs"、"\sqrt{#S/#N}"；不属于任何子节点的记号（=、√、∑）就归本节点。
//   kids  子节点；与 tex 里的占位符必须一一对应，否则报错。根节点通常是关系符（= 或 ≈），两个子节点是左右两边。
//   w     叶子的重要性，面积与它成正比；父节点的面积由子节点决定（再加上标题条），不用写。
//   glyph 父节点标题里显示的记号，缺省为 tex（子节点显示成 □）；隐式乘法这类没有可见记号的节点要写，如 "\times"。
// 悬停、高亮都直接改 class，不触发 React 重新渲染。

const SLOT = /(?<!\\)#([A-Za-z][A-Za-z0-9]*)/g;   // id 只含字母数字，这样 #lam_{…}、#a-#b 不会读错
const HEAD = 26, PAD = 3, MIN_W = 52, MIN_H = 36;
const glyph = t => renderTex(`\\nosym{${t || ""}}`);   // 格子里只是展示，不做符号标注

// 校验树并展开：plain 为完整 TeX，marked 带 \htmlClass（原式联动用），anc/desc 为祖先与后代
function compile(tree) {
  const nodes = {};
  const walk = (n, parent) => {
    if (nodes[n.id]) throw new Error(`FormulaMap: 节点 id 重复：${n.id}`);
    const kids = n.kids || [], slots = [...n.tex.matchAll(SLOT)].map(m => m[1]), ids = kids.map(k => k.id);
    const bad = [...slots.filter(s => !ids.includes(s)), ...ids.filter(i => slots.filter(s => s === i).length !== 1)];
    if (bad.length) throw new Error(`FormulaMap: 节点 ${n.id} 的 tex 占位符与 kids 不一致：${bad.join(", ")}`);
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

// squarified treemap：把 items（含 value）排进矩形 r，返回 [{id, x, y, w, h}]
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

// 给定总尺寸排一次版。标题条和边距也要占面积：把这部分折算成权重迭代几次，叶子的面积才真正与 w 成正比。
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

// 高度不够放下所有叶子时自动增高：任何节点都不会被丢掉
function layoutTree(nodes, rootId, W, minH) {
  const leaves = Object.keys(nodes).filter(id => !nodes[id].kids.length);
  let H = minH, rects;
  for (let i = 0; i < 14; i++, H = Math.round(H * 1.12)) {
    rects = layoutAt(nodes, rootId, W, H);
    if (leaves.every(id => rects[id].w >= MIN_W && rects[id].h >= MIN_H)) break;
  }
  return { rects, H };
}

// 把公式缩放到格子里放得下（直接改样式，不触发重新渲染）
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

function Cell({ id, nodes, rects, origin }) {
  const n = nodes[id], r = rects[id], area = r.w * r.h, style = { left: r.x - origin.x, top: r.y - origin.y, width: r.w, height: r.h };
  if (n.kids.length) {
    return (
      <div className={"fm-cell par" + (n.parent ? "" : " root")} data-id={id} data-role={n.role || "const"} style={style}>
        <div className="fm-head" data-hit={id} tabIndex={0} role="button" title={n.name}>
          <span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(n.head) }} /><code>{n.name}</code><span className="fm-l"><TxI>{n.label}</TxI></span>
        </div>
        {n.kids.map(k => <Cell key={k.id} id={k.id} nodes={nodes} rects={rects} origin={r} />)}
      </div>);
  }
  const fs = Math.max(13, Math.min(56, Math.sqrt(area) / 4.2));
  const showCode = r.h >= 120 && r.w >= 110, showLab = r.h >= 62 && r.w >= 90, longLab = area > 26000;
  return (
    <div className="fm-cell leaf" data-id={id} data-hit={id} data-role={n.role || "const"} style={style} tabIndex={0} role="button" title={n.name}>
      <div className="fm-body">
        <FitGlyph tex={n.plain} fs={fs} maxW={r.w - 12} maxH={r.h - 8 - (showCode ? 24 : 0) - (showLab ? (longLab ? 44 : 22) : 0)} />
        {showCode && <code>{n.name}</code>}
        {showLab && <div className={"fm-l" + (longLab ? "" : " one")}><TxI>{n.label}</TxI></div>}
      </div>
    </div>);
}

export function FormulaMap({ n, title, tree, height = 460, start }) {
  const nodes = useMemo(() => compile(tree), [tree]);
  const html = useMemo(() => renderTex(nodes[tree.id].marked, true), [nodes, tree.id]);
  const box = useRef(null), eqRef = useRef(null), detail = useRef(null), root = useRef(null);
  const hover = useRef(null), sel = useRef(start || null);
  const [W, setW] = useState(760);
  useLayoutEffect(() => {
    const update = () => setW(box.current?.clientWidth || 760);
    update();
    const ro = new ResizeObserver(update); ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const { rects, H } = useMemo(() => layoutTree(nodes, tree.id, W, height), [nodes, tree.id, W, height]);

  // 把当前状态画到 DOM 上。lit：悬停项优先，否则为选中项；只有悬停时才淡化无关块，静止时画面保持干净。
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
    }
    detail.current?.querySelectorAll(".fm-card").forEach(el => el.classList.toggle("show", el.dataset.id === (lit || "")));
  }, [nodes]);
  useLayoutEffect(paint);

  const setHover = id => { if (hover.current !== id) { hover.current = id; paint(); } };
  const select = id => { sel.current = sel.current === id ? null : id; paint(); };
  const hitOf = e => e.target.closest?.("[data-hit]")?.dataset.hit;
  const flmOf = e => { const el = e.target.closest?.(".flm"); return el && [...el.classList].find(c => c.startsWith("flm-"))?.slice(4); };

  return (
    <figure className="fm">
      <div className="fm-bar">{title && <b><TxI>{title}</TxI></b>}{n && <span className="fm-n">({n})</span>}<span className="fm-hint">嵌套 = 结构 · 面积 = 重要性 · 悬停对照原式 · 点击固定说明</span></div>
      <div className="fm-eq" ref={eqRef} dangerouslySetInnerHTML={{ __html: html }}
        onMouseOver={e => { const id = flmOf(e); if (id && nodes[id]) setHover(id); }} onMouseLeave={() => setHover(null)}
        onClick={e => { const id = flmOf(e); if (id && nodes[id]) select(id); }} />
      {/* 只有叶子和父块标题条响应悬停：鼠标经过块与块之间的缝隙时保持原状，不会闪动 */}
      <div className="fm-map" ref={el => { box.current = el; root.current = el; }} style={{ height: H }}
        onMouseOver={e => { const id = hitOf(e); if (id) setHover(id); }} onMouseLeave={() => setHover(null)}
        onFocus={e => { const id = hitOf(e); if (id) setHover(id); }} onBlur={() => setHover(null)}
        onClick={e => { const id = hitOf(e); if (id) select(id); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { const id = hitOf(e); if (id) { e.preventDefault(); select(id); } } }}>
        <Cell id={tree.id} nodes={nodes} rects={rects} origin={{ x: 0, y: 0 }} />
      </div>
      {/* 所有说明叠放在同一格，高度取最长的一条：切换时下方内容不跳动 */}
      <div className="fm-detail" ref={detail} onClick={e => { const id = e.target.closest?.("[data-crumb]")?.dataset.crumb; if (id) select(id); }}>
        <div className="fm-card fm-empty" data-id="">点任意一块，在这里看它的完整说明。</div>
        {Object.values(nodes).map(x => (
          <div key={x.id} className="fm-card" data-id={x.id} data-role={x.role || "const"}>
            <div className="fm-crumbs">{[...x.anc].reverse().map(a => <button key={a} data-crumb={a} dangerouslySetInnerHTML={{ __html: glyph(nodes[a].head) + " ›" }} />)}</div>
            <div className="fm-dh"><span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(x.plain) }} /><code>{x.name}</code><b><TxI>{x.label}</TxI></b></div>
            {x.note && <Tx>{x.note}</Tx>}
          </div>))}
      </div>
      <div className="fl-legend">{[...new Set(Object.values(nodes).map(x => x.role || "const"))].map(r => <span key={r} data-role={r}><i />{LENS_ROLES[r].zh}</span>)}</div>
    </figure>);
}

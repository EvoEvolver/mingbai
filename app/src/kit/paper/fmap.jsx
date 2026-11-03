import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { renderTex, TxI, Tx } from "../math/tex.jsx";
import { LENS_ROLES } from "./lens.jsx";

// 公式树图（FormulaMap）：把「公式的排版面积」和「讲解的面积」分开。
// 上方：公式原样、干净地显示（不加任何标注）。
// 下方：公式结构的 treemap —— 嵌套 = 公式的结构（右边整体 → 各因子 → 各符号），面积 = 重要性（不是字号）。
//   每块里：放大的符号本身、一个像代码变量的名字、一句话含义；字号随块大小变化。悬停一块，原式里对应部分亮起；点一块看完整说明。
// tex 里用 \mk{id}{子式} 标出节点；nodes: [{ id, parent?, w, name, label, note?, role?, glyph? }]
//   parent 缺省为根；叶子的面积 ∝ w，父块面积 = 子块之和（父块自身的 w 被忽略）。

const glyph = t => renderTex(`\\nosym{${t || ""}}`);   // 格子里只是展示，不做符号标注
const mkToClass = tex => tex.replace(/\\mk\{([\w-]+)\}\{/g, (_, id) => `\\htmlClass{flm flm-${id}}{`);

// squarified treemap：把 items（含 value）排进矩形 r，返回 [{item, x, y, w, h}]
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
    if (rect.w >= rect.h) { const cw = s / rect.h; let y = rect.y; row.forEach(x => { const h = x.a / cw; out.push({ item: x, x: rect.x, y, w: cw, h }); y += h; }); rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h }; }
    else { const ch = s / rect.w; let x0 = rect.x; row.forEach(x => { const w = x.a / ch; out.push({ item: x, x: x0, y: rect.y, w, h: ch }); x0 += w; }); rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch }; }
    rest = rest.slice(i);
  }
  return out;
}

// 按可用空间缩放：先以 fs 渲染，量出实际尺寸，超出则整体缩小
function FitGlyph({ tex, fs, maxW, maxH }) {
  const ref = useRef(null); const [k, setK] = useState(1); const kRef = useRef(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.scrollWidth / kRef.current, h = el.scrollHeight / kRef.current;   // 换算回未缩放时的尺寸
    const nk = Math.min(1, maxW / Math.max(1, w), Math.max(12, maxH) / Math.max(1, h));
    kRef.current = nk; setK(nk);
  }, [tex, fs, maxW, maxH]);
  return <div className="fm-g" ref={ref} style={{ fontSize: fs * k }} dangerouslySetInnerHTML={{ __html: glyph(tex) }} />;
}

export function FormulaMap({ n, title, tex, nodes, height = 460, start }) {
  const html = useMemo(() => renderTex(mkToClass(tex), true), [tex]);
  const byId = useMemo(() => Object.fromEntries(nodes.map(x => [x.id, x])), [nodes]);
  const kids = useMemo(() => { const k = {}; nodes.forEach(x => { const p = x.parent || "_root"; (k[p] = k[p] || []).push(x); }); return k; }, [nodes]);
  const value = id => (kids[id]?.length ? kids[id].reduce((s, c) => s + value(c.id), 0) : byId[id]?.w || 1);
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(start || null);
  const box = useRef(null), eqRef = useRef(null);
  const [W, setW] = useState(760);
  useLayoutEffect(() => { const ro = new ResizeObserver(() => setW(box.current?.clientWidth || 760)); ro.observe(box.current); return () => ro.disconnect(); }, []);

  // 递归布局：父块留出标题条，子块排在里面
  const rects = useMemo(() => {
    const out = [], HEAD = 26, PAD = 4;
    const lay = (pid, r, depth) => {
      const items = (kids[pid] || []).map(c => ({ id: c.id, value: value(c.id) }));
      for (const t of squarify(items, r)) {
        const node = byId[t.item.id], has = kids[node.id]?.length;
        out.push({ id: node.id, x: t.x, y: t.y, w: t.w, h: t.h, depth, parent: has });
        if (has && t.w > 40 && t.h > HEAD + 30) lay(node.id, { x: t.x + PAD, y: t.y + HEAD, w: t.w - 2 * PAD, h: t.h - HEAD - PAD }, depth + 1);
      }
    };
    lay("_root", { x: 0, y: 0, w: W, h: height }, 0);
    return out;
  }, [W, height, nodes]);

  // 原式联动高亮（含祖先链：悬停叶子时，它所在的大块也淡淡亮起）
  const lit = hover || sel;
  useLayoutEffect(() => {
    const E = eqRef.current; if (!E) return;
    E.querySelectorAll(".flm").forEach(el => {
      const id = [...el.classList].find(c => c.startsWith("flm-"))?.slice(4);
      const nd = byId[id]; if (nd) el.dataset.role = nd.role || "const";
      el.classList.toggle("fm-on", id === lit);
    });
    E.classList.toggle("fm-focus", !!lit);
  });

  const s = sel && byId[sel];
  return (
    <figure className="fm">
      <div className="fm-bar">{title && <b><TxI>{title}</TxI></b>}{n && <span className="fm-n">({n})</span>}<span className="fm-hint">面积 = 重要性 · 悬停对照原式 · 点击看说明</span></div>
      <div className="fm-eq" ref={eqRef} dangerouslySetInnerHTML={{ __html: html }}
        onMouseOver={e => { const el = e.target.closest?.(".flm"); const id = el && [...el.classList].find(c => c.startsWith("flm-"))?.slice(4); setHover(id && byId[id] ? id : null); }}
        onMouseLeave={() => setHover(null)} />
      <div className="fm-map" ref={box} style={{ height }}>
        {rects.map(r => { const nd = byId[r.id], area = r.w * r.h, big = !r.parent;
          const fs = Math.max(13, Math.min(56, Math.sqrt(area) / 4.2));
          const tight = r.h < 64 || r.w < 96;
          return (
            <div key={r.id} className={"fm-cell" + (r.parent ? " par" : " leaf") + (lit === r.id ? " on" : "") + (tight ? " tight" : "")}
              data-role={nd.role || "const"} style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
              onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)} onClick={e => { e.stopPropagation(); setSel(sel === r.id ? null : r.id); }}>
              {r.parent
                ? <div className="fm-head"><span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(nd.glyph) }} /><code>{nd.name}</code><span className="fm-l"><TxI>{nd.label}</TxI></span></div>
                : big && (() => { const showCode = r.h >= 120 && r.w >= 110, showLab = r.h >= 62 && r.w >= 90;
                    return <div className="fm-body">
                      {nd.glyph && <FitGlyph tex={nd.glyph} fs={fs} maxW={r.w - 16} maxH={r.h - 12 - (showCode ? 28 : 0) - (showLab ? (area > 26000 ? 44 : 22) : 0)} />}
                      {showCode && <code>{nd.name}</code>}
                      {showLab && <div className={"fm-l" + (area > 26000 ? "" : " one")}><TxI>{nd.label}</TxI></div>}
                    </div>; })()}
            </div>);
        })}
      </div>
      <div className={"fm-detail" + (s ? " show" : "")} data-role={s?.role || "const"}>
        {s ? <>
          <div className="fm-dh"><span className="fm-g" dangerouslySetInnerHTML={{ __html: glyph(s.glyph) }} /><code>{s.name}</code><b><TxI>{s.label}</TxI></b><button onClick={() => setSel(null)}>×</button></div>
          {s.note && <Tx>{s.note}</Tx>}
        </> : <span className="fm-empty">点任意一块，在这里看它的完整说明。</span>}
      </div>
      <div className="fl-legend">{[...new Set(nodes.map(x => x.role || "const"))].map(r => <span key={r} data-role={r}><i />{LENS_ROLES[r].zh}</span>)}</div>
    </figure>);
}

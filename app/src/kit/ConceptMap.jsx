import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY } from "d3-force";
import { useChapter } from "./core.jsx";
import { Rich, needsRich, plainText } from "./math/tex.jsx";

// 概念关系图：d3-force 实时力导向布局。
// - 节点半径随连接数增大；碰撞半径把下方标签宽度算进去，避免文字重叠
// - 布局稳定后自动缩放到可视区域；拖节点会重新加热布局
// - 拖空白处平移，按钮或 Ctrl/⌘+滚轮缩放；悬停高亮邻居，点击打开概念卡
// - 节点多时连线标签只在悬停时显示
// 默认读取 ChapterPage 的 concepts/relations；可选 nodes（id 子集）与 edges（自定义关系，可跨章）。
const labelW = s => [...plainText(String(s)) || String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 14 : 7.5), 0);

function bounds(nodes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const hw = Math.max(n.r, n.lw / 2) + 6;
    x0 = Math.min(x0, n.x - hw); x1 = Math.max(x1, n.x + hw);
    y0 = Math.min(y0, n.y - n.r - 6); y1 = Math.max(y1, n.y + n.r + 26);
  }
  const pad = 20;
  return nodes.length ? { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad } : { x: 0, y: 0, w: 900, h: 600 };
}

// SVG 中的文字标签：含 $…$ 时用 foreignObject + Rich 渲染 KaTeX，否则用普通 <text>
function SvgLabel({ x = 0, y, text, w = 220, cls = "" }) {
  if (!needsRich(text)) return <text textAnchor="middle" x={x} y={y} className={cls}>{text}</text>;
  return <foreignObject x={x - w / 2} y={y - 15} width={w} height={22} className={"svgrich " + cls}><div><Rich>{text}</Rich></div></foreignObject>;
}

export function ConceptMap({ height = 600, nodes: only, edges: customEdges }) {
  const ctx = useChapter(), { open, color } = ctx;
  const relations = customEdges || ctx.relations;
  const concepts = useMemo(() => {
    const ids = only || (customEdges ? [...new Set(customEdges.flatMap(e => [e.from, e.to]))] : null);
    return ids ? ids.map(id => ctx.byId[id]).filter(Boolean) : ctx.concepts;
  }, [only, customEdges, ctx]);
  const big = concepts.length > 24;

  // 图数据（模拟会原地改写 x/y）
  const graph = useMemo(() => {
    const nodes = concepts.map(c => ({ id: c.id, c, lw: labelW(c.name_zh) }));
    const N = Object.fromEntries(nodes.map(n => [n.id, n]));
    // 连线直接引用节点对象，节点给出初始位置，保证模拟启动前的首帧也能画
    nodes.forEach((n, i) => { const a = i / nodes.length * 2 * Math.PI; n.x = 300 * Math.cos(a); n.y = 300 * Math.sin(a); });
    const links = relations.filter(r => N[r.from] && N[r.to] && r.from !== r.to).map(r => ({ ...r, source: N[r.from], target: N[r.to] }));
    const deg = {}; links.forEach(l => { deg[l.from] = (deg[l.from] || 0) + 1; deg[l.to] = (deg[l.to] || 0) + 1; });
    nodes.forEach(n => { n.deg = deg[n.id] || 0; n.r = 14 + Math.min(4 * n.deg, 22); });
    return { nodes, links };
  }, [concepts, relations]);

  const [, setFrame] = useState(0);
  const [view, setView] = useState(null);       // 当前 viewBox
  const [hover, setHover] = useState(null);
  const [panning, setPanning] = useState(false);
  const svg = useRef(null), sim = useRef(null), drag = useRef(null), raf = useRef(0);

  const fit = () => setView(bounds(graph.nodes));
  const redraw = () => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setFrame(f => f + 1); }); };

  const relayout = () => {
    const s = sim.current; if (!s) return;
    graph.nodes.forEach((n, i) => { const a = i / graph.nodes.length * 2 * Math.PI; n.x = 300 * Math.cos(a); n.y = 300 * Math.sin(a); n.vx = n.vy = 0; n.fx = n.fy = null; });
    fit();
    s.alpha(1).restart();
  };

  useEffect(() => {
    const n = graph.nodes.length;
    const s = forceSimulation(graph.nodes)
      .force("charge", forceManyBody().strength(-420 - 6 * n).distanceMax(900))
      .force("link", forceLink(graph.links).id(d => d.id).distance(l => 80 + l.source.r + l.target.r + (big ? 0 : 70)).strength(.4))
      .force("collide", forceCollide(d => Math.max(d.r + 14, d.lw / 2 + 14)).strength(1).iterations(4))
      .force("x", forceX(0).strength(.04)).force("y", forceY(0).strength(.06))
      .stop();
    // 先离线跑到基本稳定，首屏直接呈现成品布局
    s.tick(Math.ceil(Math.log(s.alphaMin()) / Math.log(1 - s.alphaDecay())));
    sim.current = s;
    setView(bounds(graph.nodes));
    s.on("tick", redraw).on("end", () => { if (!drag.current) setView(bounds(graph.nodes)); });
    return () => { s.stop(); cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [graph, big]);

  const toSvg = ev => { const p = svg.current.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.current.getScreenCTM().inverse()); };
  const zoom = (k, cx, cy) => setView(v => {
    if (!v) return v;
    cx ??= v.x + v.w / 2; cy ??= v.y + v.h / 2;
    return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: v.w * k, h: v.h * k };
  });

  // Ctrl/⌘ + 滚轮缩放（普通滚轮仍滚动页面）
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const f = e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const p = toSvg(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); };
    el.addEventListener("wheel", f, { passive: false });
    return () => el.removeEventListener("wheel", f);
  }, []);

  const nb = hover && new Set([hover, ...graph.links.filter(l => l.from === hover || l.to === hover).flatMap(l => [l.from, l.to])]);
  const v = view || { x: 0, y: 0, w: 900, h: 600 };

  return (
    <div className="mapwrap">
      <div className="map-tools">
        <button onClick={() => zoom(1 / 1.25)} title="放大">＋</button>
        <button onClick={() => zoom(1.25)} title="缩小">－</button>
        <button onClick={fit} title="适应窗口">⤢ 适应</button>
        <button onClick={relayout} title="重新布局">↻ 重新布局</button>
      </div>
      <svg ref={svg} viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} style={{ height, cursor: panning ? "grabbing" : "grab" }}
        onPointerDown={ev => {
          if (ev.target.closest(".node")) return;
          svg.current.setPointerCapture(ev.pointerId);
          drag.current = { pan: true, start: toSvg(ev) }; setPanning(true);
        }}
        onPointerMove={ev => {
          const g = drag.current; if (!g) return;
          const p = toSvg(ev);
          if (g.pan) { setView(cur => ({ ...cur, x: cur.x - (p.x - g.start.x), y: cur.y - (p.y - g.start.y) })); return; }
          g.moved = true; g.node.fx = p.x; g.node.fy = p.y;
          sim.current.alphaTarget(.3).restart();
        }}
        onPointerUp={() => {
          const g = drag.current; drag.current = null; setPanning(false); if (!g) return;
          if (g.node) { g.node.fx = g.node.fy = null; sim.current.alphaTarget(0); if (!g.moved) open(g.node.id); }
        }}>
        <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#c9b99c" /></marker></defs>
        {graph.links.map((l, i) => {
          const a = l.source, b = l.target;
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
          const on = hover && (l.from === hover || l.to === hover);
          return <g key={i} className={"edge" + (hover && !on ? " dim" : "")}>
            <line markerEnd="url(#arr)" x1={a.x + dx / L * a.r} y1={a.y + dy / L * a.r} x2={b.x - dx / L * (b.r + 3)} y2={b.y - dy / L * (b.r + 3)} />
            {(!big || on) && <SvgLabel x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} text={l.label} w={180} />}
          </g>;
        })}
        {graph.nodes.map(n =>
          <g key={n.id} className={"node" + (nb && !nb.has(n.id) ? " dim" : "")} transform={`translate(${n.x},${n.y})`}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
            onPointerDown={ev => { ev.stopPropagation(); svg.current.setPointerCapture(ev.pointerId); drag.current = { node: n, moved: false }; }}>
            <circle r={n.r} fill={color(n.c.group)} />
            <text textAnchor="middle" dy="5" fontSize={n.r * .9}>{n.c.icon}</text>
            <SvgLabel y={n.r + 18} text={n.c.name_zh} w={Math.max(120, n.lw + 30)} cls="nlab" />
          </g>)}
      </svg>
      <div className="hint">拖动节点 · 拖空白处平移 · Ctrl/⌘+滚轮缩放 · 点击节点打开概念卡</div>
    </div>);
}

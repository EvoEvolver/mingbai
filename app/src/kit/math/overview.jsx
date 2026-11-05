import { t } from "../i18n/index.js";
import { useMemo, useState } from "react";
import { TxI, Rich, FitTex, plainText, useTextbook, anchor } from "./tex.jsx";
import { EqChip } from "./env.jsx";

// ---------- 章节路线图 ----------
// steps: [{ sec:"2.1", title:"膨胀的空间", gist:"一句话（可含 $…$）", gives:["2.12","2.28"], next?:"→ 下一步为什么需要（过渡语）" }]
// 竖向链条：每节一张卡（点击标题跳转到该节），卡内列出该节产出的关键方程（点击放大）。
export function Roadmap({ steps }) {
  const go = n => e => { e.preventDefault(); document.getElementById(anchor("sec", n))?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return (
    <div className="roadmap">{steps.map((s, i) =>
      <div key={i} className="rm-step">
        <div className="rm-card">
          <a className="rm-title" href={`#sec-${s.sec}`} onClick={go(s.sec)}><span className="tb-num">§{s.sec}</span> <Rich>{s.title}</Rich></a>
          {s.gist && <div className="rm-gist"><TxI>{s.gist}</TxI></div>}
          {s.gives?.length > 0 && <div className="rm-gives">{s.gives.map(n => <EqChip key={n} n={n} />)}</div>}
        </div>
        {i < steps.length - 1 && <div className="rm-arrow"><span>↓</span>{s.next && <em><TxI>{s.next}</TxI></em>}</div>}
      </div>)}
    </div>);
}

// ---------- 推导路线图 ----------
// edges: [{ from:"2.20", to:"2.28", label:"代入 FLRW 度规" }]；labels: { "2.20": "测地线方程" }（可选，默认取 Eq 的 title）
// 按最长路径分层，从左到右排列；点击节点放大公式；悬停高亮其上下游。
export function EqMap({ edges, labels = {}, colW = 420, rowH = 124 }) {
  const tb = useTextbook();
  const [hover, setHover] = useState(null);
  const NW = 270, NH = 104, GAP = colW - NW, LW = GAP - 14, LH = 34;   // 列间空隙与标签尺寸
  const g = useMemo(() => {
    const ids = [...new Set(edges.flatMap(e => [e.from, e.to]))];
    const preds = Object.fromEntries(ids.map(i => [i, edges.filter(e => e.to === i).map(e => e.from)]));
    const lvl = {}, visiting = new Set();
    const L = i => {
      if (lvl[i] != null) return lvl[i];
      if (visiting.has(i)) return 0;                       // 防环
      visiting.add(i);
      const v = preds[i].length ? 1 + Math.max(...preds[i].map(L)) : 0;
      visiting.delete(i); return (lvl[i] = v);
    };
    ids.forEach(L);
    const cols = {}; ids.forEach(i => (cols[lvl[i]] ??= []).push(i));
    Object.values(cols).forEach(c => c.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    const maxRows = Math.max(...Object.values(cols).map(c => c.length));
    const pos = {};
    Object.entries(cols).forEach(([l, c]) => c.forEach((id, r) => { pos[id] = { x: 20 + l * colW, y: 20 + (r + (maxRows - c.length) / 2) * rowH }; }));
    const H = 40 + maxRows * rowH - (rowH - NH);
    // 连线几何：三次贝塞尔；标签放在「目标节点前的列间空隙」中心，纵坐标取曲线在该处的高度
    const geo = edges.map((e, i) => {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) return null;
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x - 4, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
      const bez = t => { const u = 1 - t; return [u * u * u * x1 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x2, u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2]; };
      const lx = b.x - GAP / 2;
      let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (bez(m)[0] < lx) lo = m; else hi = m; }
      return { i, e, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, lx, ly: bez(lo)[1], gap: lvl[e.to] };
    }).filter(Boolean);
    // 同一空隙内的标签按纵坐标排开，避免互相重叠
    const byGap = {}; geo.filter(x => x.e.label).forEach(x => (byGap[x.gap] ??= []).push(x));
    Object.values(byGap).forEach(list => {
      list.sort((a, b) => a.ly - b.ly);
      for (let k = 1; k < list.length; k++) if (list[k].ly - list[k - 1].ly < LH + 4) list[k].ly = list[k - 1].ly + LH + 4;
      const over = list.length ? list[list.length - 1].ly + LH / 2 - (H - 6) : 0;   // 底部溢出则整体上移
      if (over > 0) list.forEach(x => { x.ly = Math.max(LH / 2 + 4, x.ly - over); });
    });
    return { ids, pos, geo, W: 40 + (Object.keys(cols).length - 1) * colW + NW, H };
  }, [edges, colW, rowH, GAP, LH]);
  // 悬停时高亮上下游
  const related = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    const up = id => edges.filter(e => e.to === id).forEach(e => { if (!s.has(e.from)) { s.add(e.from); up(e.from); } });
    const down = id => edges.filter(e => e.from === id).forEach(e => { if (!s.has(e.to)) { s.add(e.to); down(e.to); } });
    up(hover); down(hover); return s;
  }, [hover, edges]);
  const isDim = e => related && !(related.has(e.from) && related.has(e.to));
  return (
    <div className="eqmap card">
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width={g.W} height={g.H}>
        <defs><marker id="eqarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#b8a888" /></marker></defs>
        {g.geo.map(x => <path key={x.i} d={x.d} markerEnd="url(#eqarr)" className={"eqm-edge" + (isDim(x.e) ? " dim" : related ? " hot" : "")} />)}
        {g.ids.map(id => {
          const p = g.pos[id], info = tb?.eqs.current.get(id);
          const dim = related && !related.has(id);
          return <foreignObject key={id} x={p.x} y={p.y} width={NW} height={NH} className={dim ? "dim" : ""}>
            <div className="eqm-node" onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
              onClick={() => info && tb.openEq({ tex: info.tex, n: id, title: info.title, say: info.say })}>
              <div className="eqm-t">({id}) <Rich>{labels[id] || info?.title || ""}</Rich></div>
              {info && <FitTex tex={info.tex} display min={0.3} both className="eqm-m" />}
            </div>
          </foreignObject>;
        })}
        {/* 连线标签画在最上层 */}
        {g.geo.filter(x => x.e.label).map(x =>
          <foreignObject key={"l" + x.i} x={x.lx - LW / 2} y={x.ly - LH / 2} width={LW} height={LH} className={"eqm-lfo" + (isDim(x.e) ? " dim" : "")}>
            <div className={"eqm-elab" + (related && !isDim(x.e) ? " on" : "")} title={plainText(x.e.label)}><span className="eqm-elab-t"><TxI>{x.e.label}</TxI></span></div>
          </foreignObject>)}
      </svg>
      <div className="hint">{t("eqmap.hint")}</div>
    </div>);
}

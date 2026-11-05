import { t } from "../i18n/index.js";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { renderTex, TxI, Tx } from "../math/tex.jsx";

// 公式透镜：让公式内部的重要性看得见。
// 公式难读的一个根本原因：承载关键信息的常常是最小的字符（撇号、下标、帽子、求和指标），而公式里既不能写变量名，也不能插注释。
// FormulaLens 给公式补上代码有、公式没有的东西：
//   注释 —— 从任意子式引出标签与引线（关键小字符在标签里放大显示）
//   角色着色 —— 已知 / 未知 / 设计参数 / 常数 / 结果，各一种颜色，全站含义固定
//   逐步 —— 按讲解顺序逐项点亮
//   代码 —— 改写成带变量名与注释的伪代码，逐行与公式联动
// 在 tex 里用 \mk{id}{子式} 标出部分；parts 给每个 id 写 label / note / role / glyph。
//
// parts: [{ id, label, note?, role?: "known"|"unknown"|"design"|"const"|"result", glyph?: "S'"（标签里放大显示的 TeX）, side?: "top"|"bottom" }]
// steps: [{ ids: [...], text }]      code: [{ ids: [...], src: "…", note: "…" }]

export const LENS_ROLES = {
  unknown: { c: "#b4372a" },
  known: { c: "#2c5d8f" },
  design: { c: "#2f7a4a" },
  const: { c: "#9a6b12" },
  result: { c: "#6a3f8f" },
};
export const roleLabel = r => t("lens.role")[r];

const mkToClass = tex => tex.replace(/\\mk\{([\w-]+)\}\{/g, (_, id) => `\\htmlClass{flm flm-${id}}{`);

export function FormulaLens({ n, title, tex, parts = [], steps, code, legend = true, height }) {
  const modes = [["note", t("lens.note")], steps?.length && ["step", t("lens.step")], code?.length && ["code", t("lens.code")]].filter(Boolean);
  const [mode, setMode] = useState("note");
  const [hover, setHover] = useState(null);
  const [step, setStep] = useState(0);
  const wrap = useRef(null), eqRef = useRef(null);
  const [geo, setGeo] = useState({ boxes: {}, w: 0, h: 0, eqTop: 0, eqH: 0 });
  const html = useMemo(() => renderTex(mkToClass(tex), true), [tex]);
  const byId = Object.fromEntries(parts.map(p => [p.id, p]));

  // 测量各部分在容器里的位置，给元素加角色类
  useLayoutEffect(() => {
    const measure = () => {
      const W = wrap.current, E = eqRef.current; if (!W || !E) return;
      const wr = W.getBoundingClientRect(), er = E.getBoundingClientRect(), boxes = {};
      for (const p of parts) {
        const els = E.querySelectorAll(".flm-" + p.id); if (!els.length) continue;
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        els.forEach(el => { el.dataset.role = p.role || "const"; el.dataset.fid = p.id; const r = el.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
        boxes[p.id] = { x0: x0 - wr.left, x1: x1 - wr.left, y0: y0 - wr.top, y1: y1 - wr.top };
      }
      setGeo({ boxes, w: wr.width, h: wr.height, eqTop: er.top - wr.top, eqH: er.height });
    };
    measure(); const t = setTimeout(measure, 300); const ro = new ResizeObserver(measure); ro.observe(wrap.current);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [html, mode]);

  // 当前高亮集合
  const lit = mode === "step" ? new Set(steps.slice(0, step + 1).flatMap(s => s.ids)) : null;
  const cur = mode === "step" ? new Set(steps[step].ids) : hover ? new Set([hover]) : null;
  useLayoutEffect(() => {
    const E = eqRef.current; if (!E) return;
    E.querySelectorAll(".flm").forEach(el => {
      const id = el.dataset.fid;
      el.classList.toggle("fl-dim", !!lit && !lit.has(id) && !hasLitChild(el, lit));
      el.classList.toggle("fl-on", !!cur && cur.has(id));
    });
    E.classList.toggle("fl-stepping", !!lit);
  });

  const onOver = e => { const el = e.target.closest?.(".flm"); setHover(el ? el.dataset.fid : null); };

  // 注释标签布局：上下两行，按 x 排开、互不重叠
  const placed = useMemo(() => layoutLabels(parts, geo, mode === "note"), [parts, geo, mode]);
  const top = placed.filter(l => l.side === "top"), bottom = placed.filter(l => l.side === "bottom");
  const rowH = 74, pad = mode === "note" && top.length ? rowH : 0, padB = mode === "note" && bottom.length ? rowH : 0;

  return (
    <figure className="fl" data-eqn={n || undefined}>
      <div className="fl-bar">
        {title && <b className="fl-title"><TxI>{title}</TxI></b>}
        {n && <span className="fl-n">({n})</span>}
        <span className="fl-modes">{modes.map(([k, t]) => <button key={k} className={mode === k ? "on" : ""} onClick={() => { setMode(k); setStep(0); }}>{t}</button>)}</span>
      </div>
      <div className="fl-stage" ref={wrap} style={{ paddingTop: pad, paddingBottom: padB, minHeight: height }} onMouseOver={onOver} onMouseLeave={() => setHover(null)}>
        <div className="fl-eq" ref={eqRef} dangerouslySetInnerHTML={{ __html: html }} />
        {mode === "note" && <svg className="fl-svg" width={geo.w} height={geo.h}>
          {placed.map(l => { const b = geo.boxes[l.id]; if (!b) return null; const cx = (b.x0 + b.x1) / 2, on = hover === l.id;
            const yb = l.side === "top" ? b.y0 - 3 : b.y1 + 3, yl = l.side === "top" ? pad - 6 : geo.h - padB + 6;
            return <g key={l.id} className={"fl-ln" + (on ? " on" : "")} style={{ "--rc": LENS_ROLES[byId[l.id].role || "const"].c }}>
              <path d={`M${b.x0},${yb} L${b.x0},${yb + (l.side === "top" ? -4 : 4)} L${b.x1},${yb + (l.side === "top" ? -4 : 4)} L${b.x1},${yb}`} />
              <path d={`M${cx},${yb + (l.side === "top" ? -4 : 4)} L${l.x},${yl}`} />
            </g>; })}
        </svg>}
        {mode === "note" && placed.map(l => { const p = byId[l.id];
          return <div key={l.id} className={"fl-lab " + l.side + (hover === l.id ? " on" : "")} data-role={p.role || "const"}
            style={{ left: l.left, width: l.w, top: l.side === "top" ? 0 : undefined, bottom: l.side === "bottom" ? 0 : undefined }}
            onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)}>
            {p.glyph && <span className="fl-glyph" dangerouslySetInnerHTML={{ __html: renderTex(p.glyph) }} />}
            <span className="fl-lt"><TxI>{p.label}</TxI></span>
          </div>; })}
      </div>

      {mode === "note" && <div className="fl-notes">{parts.filter(p => p.note).map(p => (
        <div key={p.id} className={"fl-note" + (hover === p.id ? " on" : "")} data-role={p.role || "const"} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
          <span className="fl-chip" dangerouslySetInnerHTML={{ __html: renderTex(p.glyph || "\\bullet") }} /><b><TxI>{p.label}</TxI></b><span><TxI>{p.note}</TxI></span>
        </div>))}</div>}

      {mode === "step" && <div className="fl-steps">
        <div className="fl-step-t"><span>{step + 1} / {steps.length}</span><Tx>{steps[step].text}</Tx></div>
        <div className="fl-step-nav">
          <button disabled={step === 0} onClick={() => setStep(step - 1)}>{t("ui.prevStep")}</button>
          <div className="fl-dots">{steps.map((_, i) => <i key={i} className={i === step ? "on" : i < step ? "done" : ""} onClick={() => setStep(i)} />)}</div>
          <button disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>{t("ui.nextStep")}</button>
        </div>
      </div>}

      {mode === "code" && <div className="fl-code">{code.map((c, i) => (
        <div key={i} className={"fl-cl" + (c.ids?.some(id => hover === id) ? " on" : "")} onMouseEnter={() => setHover(c.ids?.[0] || null)} onMouseLeave={() => setHover(null)}>
          <code>{c.src}</code>{c.note && <span className="fl-cc"># {c.note}</span>}
        </div>))}<div className="fl-code-h">{t("lens.codeHint")}</div></div>}

      {legend && <div className="fl-legend">{[...new Set(parts.map(p => p.role || "const"))].map(r => <span key={r} data-role={r}><i />{roleLabel(r)}</span>)}</div>}
    </figure>);
}

function hasLitChild(el, lit) { for (const c of el.querySelectorAll(".flm")) if (lit.has(c.dataset.fid)) return true; return false; }

// 标签布局：默认交替上下；同一行内按 x 排序后向右推开避免重叠，越界则整体左移
function layoutLabels(parts, geo, on) {
  if (!on || !geo.w) return [];
  const W = geo.w, out = [];
  const items = parts.filter(p => geo.boxes[p.id]).map(p => ({ id: p.id, cx: (geo.boxes[p.id].x0 + geo.boxes[p.id].x1) / 2, side: p.side }));
  items.sort((a, b) => a.cx - b.cx);
  items.forEach((it, i) => { if (!it.side) it.side = i % 2 ? "bottom" : "top"; });
  for (const side of ["top", "bottom"]) {
    const row = items.filter(i => i.side === side), w = Math.min(190, Math.max(120, (W - 16) / Math.max(1, row.length) - 8));
    let x = 4;
    const ls = row.map(it => { const left = Math.max(x, it.cx - w / 2); x = left + w + 8; return { ...it, left, w }; });
    const over = ls.length ? ls[ls.length - 1].left + w - (W - 4) : 0;
    if (over > 0) ls.forEach(l => { l.left = Math.max(4, l.left - over); });
    for (let i = 1; i < ls.length; i++) ls[i].left = Math.max(ls[i].left, ls[i - 1].left + w + 8);
    ls.forEach(l => out.push({ id: l.id, side, left: l.left, w, x: l.left + w / 2 }));
  }
  return out;
}

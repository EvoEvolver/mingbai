import { t } from "../i18n/index.js";
import { useId, useMemo, useRef, useState } from "react";
import { renderTex, Rich } from "./tex.jsx";

// ================= 数值工具 =================
export const num = {
  linspace: (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)),
  logspace: (a, b, n) => Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1))),   // a,b 为端点本身（非指数）
  // Simpson 积分（n 为偶数段数）；对数坐标下积分可设 log=true（对 ln x 积分，a,b>0）
  integrate(f, a, b, n = 400, log = false) {
    if (a === b) return 0;
    if (n % 2) n++;
    if (log) { const g = u => { const x = Math.exp(u); return f(x) * x; }; return num.integrate(g, Math.log(a), Math.log(b), n); }
    const h = (b - a) / n; let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  },
  // 累积积分：返回在 xs 各点上的 ∫_{xs[0]}^{x} f（梯形）
  cumtrapz(f, xs) { const out = [0]; for (let i = 1; i < xs.length; i++) out.push(out[i - 1] + (f(xs[i]) + f(xs[i - 1])) / 2 * (xs[i] - xs[i - 1])); return out; },
  // RK4 求解 y' = f(t, y)（y 可为数组）。返回 {t:[...], y:[...]}，共 n 步
  rk4(f, y0, t0, t1, n = 500) {
    const vec = Array.isArray(y0), add = (a, b, k) => vec ? a.map((v, i) => v + b[i] * k) : a + b * k;
    const h = (t1 - t0) / n; let t = t0, y = y0; const T = [t], Y = [y];
    for (let i = 0; i < n; i++) {
      const k1 = f(t, y), k2 = f(t + h / 2, add(y, k1, h / 2)), k3 = f(t + h / 2, add(y, k2, h / 2)), k4 = f(t + h, add(y, k3, h));
      y = vec ? y.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) : y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      t += h; T.push(t); Y.push(y);
    }
    return { t: T, y: Y };
  },
  // 二分求根
  bisect(f, a, b, tol = 1e-10, it = 200) { let fa = f(a); for (let i = 0; i < it; i++) { const m = (a + b) / 2, fm = f(m); if (Math.abs(b - a) < tol) return m; if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; },
  // 线性插值（xs 单调递增）
  interp(xs, ys, x) { let lo = 0, hi = xs.length - 1; if (x <= xs[0]) return ys[0]; if (x >= xs[hi]) return ys[hi]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] > x) hi = m; else lo = m; } const t = (x - xs[lo]) / (xs[hi] - xs[lo]); return ys[lo] + t * (ys[hi] - ys[lo]); },
};

// ================= 刻度 =================
function niceTicks(lo, hi, n = 6) {
  const span = hi - lo, step0 = Math.pow(10, Math.floor(Math.log10(span / n)));
  const err = span / n / step0, step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const out = []; for (let k = Math.ceil(lo / step); k * step <= hi + step * 1e-9; k++) { const v = k * step; out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12)); }   // 用整数倍生成，避免跨 0 时的浮点累积
  return out;
}
function logTicks(lo, hi) {
  const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi)), stride = Math.max(1, Math.ceil((b - a) / 8)), out = [];
  for (let e = a; e <= b; e += stride) { const v = Math.pow(10, e); if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); }
  return out;
}
const fmt = (v, log) => {
  if (log) { const e = Math.round(Math.log10(v)); return Math.abs(e) <= 2 ? String(+v.toPrecision(3)) : `10^{${e}}`; }
  if (v === 0) return "0"; const a = Math.abs(v);
  return a >= 1e4 || a < 1e-3 ? v.toExponential(1).replace(/e\+?(-?)0*(\d+)/, "\\times10^{$1$2}") : String(+v.toPrecision(4));
};
const COLORS = ["#1f1b16", "#c0392b", "#2c6e49", "#2c4a6e", "#b8862b", "#7d3c98", "#16808a"];
const DASH = { solid: "", dash: "7 5", dot: "2 4", dashdot: "8 4 2 4" };

// ================= 交互绘图 =================
// <Plot
//   x={{ label: String.raw`z`, log: true, domain: [0.01, 10] }}
//   y={{ label: String.raw`d\ [h^{-1}\,\mathrm{Mpc}]`, log: true, domain?: [lo, hi] }}
//   params={[{ id: "Om", label: String.raw`\Omega_m`, min: 0.05, max: 1, step: 0.01, value: 0.3 }]}
//   series={p => [{ label: String.raw`\chi`, f: z => ..., color?, dash?: "dash" }, { label, data: [[x,y],...], points: true, err?: [[x,y,dy],...] }]}
//   vlines={p => [{ x: 1, label: "z=1" }]} samples={300} height={380} />
// 公式标签（label）按 LaTeX 渲染。series 函数只在参数变化时重算。
export function Plot({ x, y, params = [], series, vlines, samples = 300, height = 380, caption }) {
  const [pv, setPv] = useState(() => Object.fromEntries(params.map(p => [p.id, p.value])));
  const [hx, setHx] = useState(null);
  const svg = useRef(null), cid = "pc" + useId().replace(/:/g, "");
  const W = 680, H = height, m = { l: 70, r: 20, t: 16, b: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const data = useMemo(() => {
    const ss = (typeof series === "function" ? series(pv) : series) || [];
    const [x0, x1] = x.domain;
    const xs = x.log ? num.logspace(x0, x1, samples) : num.linspace(x0, x1, samples);
    return ss.map((s, i) => ({
      ...s, color: s.color || COLORS[i % COLORS.length],
      pts: s.data ? s.data : xs.map(v => [v, s.f(v)]).filter(([, v]) => Number.isFinite(v) && (!y.log || v > 0)),
    }));
  }, [series, pv, x.domain?.[0], x.domain?.[1], x.log, samples]);

  const yd = useMemo(() => {
    if (y.domain) return y.domain;
    const all = data.flatMap(s => s.pts.map(p => p[1])).filter(v => Number.isFinite(v) && (!y.log || v > 0));
    if (!all.length) return [0, 1];
    let lo = Math.min(...all), hi = Math.max(...all);
    if (y.log) return [lo / 1.3, hi * 1.3];
    const pad = (hi - lo) * 0.06 || 1; return [lo - pad, hi + pad];
  }, [data, y.domain, y.log]);

  const sx = v => m.l + (x.log ? Math.log(v / x.domain[0]) / Math.log(x.domain[1] / x.domain[0]) : (v - x.domain[0]) / (x.domain[1] - x.domain[0])) * iw;
  const sy = v => m.t + ih - (y.log ? Math.log(v / yd[0]) / Math.log(yd[1] / yd[0]) : (v - yd[0]) / (yd[1] - yd[0])) * ih;
  const inv = px => { const t = (px - m.l) / iw; return x.log ? x.domain[0] * Math.pow(x.domain[1] / x.domain[0], t) : x.domain[0] + t * (x.domain[1] - x.domain[0]); };
  const clampY = v => Math.max(m.t - 2, Math.min(m.t + ih + 2, v));
  const xt = x.log ? logTicks(...x.domain) : niceTicks(...x.domain);
  const yt = y.log ? logTicks(...yd) : niceTicks(...yd);
  const vl = vlines ? (typeof vlines === "function" ? vlines(pv) : vlines) : [];

  const path = pts => pts.map(([a, b], i) => `${i ? "L" : "M"}${sx(a).toFixed(1)},${clampY(sy(b)).toFixed(1)}`).join("");
  const readout = hx != null && data.filter(s => !s.data || s.points === false).map(s => ({ s, v: s.f ? s.f(hx) : null })).filter(r => r.v != null && Number.isFinite(r.v));

  const T = ({ tex, ...props }) => <foreignObject {...props}><div className="plot-tex" dangerouslySetInnerHTML={{ __html: renderTex(tex) }} /></foreignObject>;

  return (
    <div className="plot card">
      {params.length > 0 && <div className="plot-params">{params.map(p => {
        const val = pv[p.id];
        const toS = v => (p.log ? Math.log10(v) : v), fromS = s => (p.log ? Math.pow(10, s) : s);
        return <label key={p.id} className="plot-param">
          <span className="plot-plabel" dangerouslySetInnerHTML={{ __html: renderTex(`${p.label} = ${+(+val).toPrecision(3)}`) }} />
          <input type="range" min={toS(p.min)} max={toS(p.max)} step={p.log ? 0.01 : p.step || (p.max - p.min) / 100} value={toS(val)}
            onChange={e => setPv(s => ({ ...s, [p.id]: fromS(+e.target.value) }))} />
        </label>;
      })}
        <button className="plot-reset" onClick={() => setPv(Object.fromEntries(params.map(p => [p.id, p.value])))}>{t("ui.reset")}</button>
      </div>}
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="plot-svg"
        onMouseMove={e => { const pt = svg.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(svg.current.getScreenCTM().inverse()); setHx(q.x >= m.l && q.x <= m.l + iw ? inv(q.x) : null); }}
        onMouseLeave={() => setHx(null)}>
        <defs><clipPath id={cid}><rect x={m.l} y={m.t} width={iw} height={ih} /></clipPath></defs>
        {xt.map(v => <g key={"x" + v}><line x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + ih} className="plot-grid" />
          <T tex={fmt(v, x.log)} x={sx(v) - 30} y={m.t + ih + 4} width={60} height={22} /></g>)}
        {yt.map(v => <g key={"y" + v}><line x1={m.l} x2={m.l + iw} y1={sy(v)} y2={sy(v)} className="plot-grid" />
          <T tex={fmt(v, y.log)} x={m.l - 64} y={sy(v) - 11} width={58} height={22} /></g>)}
        <rect x={m.l} y={m.t} width={iw} height={ih} className="plot-frame" />
        {vl.map((v, i) => v.x >= Math.min(...x.domain) && v.x <= Math.max(...x.domain) && <g key={"v" + i}>
          <line x1={sx(v.x)} x2={sx(v.x)} y1={m.t} y2={m.t + ih} className="plot-vline" />
          {v.label && (sx(v.x) > m.l + iw - 110   // 贴近右边框时标签放到竖线左侧
            ? <T tex={v.label} x={sx(v.x) - 123} y={m.t + 2} width={120} height={22} className="plot-vlab-r" />
            : <T tex={v.label} x={sx(v.x) + 3} y={m.t + 2} width={120} height={22} className="plot-vlab" />)}</g>)}
        <g clipPath={`url(#${cid})`}>{data.map((s, i) => <g key={i}>
          {!s.points && <path d={path(s.pts)} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={DASH[s.dash || "solid"]} />}
          {s.points && s.pts.map(([a, b], j) => <circle key={j} cx={sx(a)} cy={sy(b)} r={3} fill={s.color} />)}
          {s.err && s.err.map(([a, b, e], j) => <line key={"e" + j} x1={sx(a)} x2={sx(a)} y1={sy(b - e)} y2={sy(b + e)} stroke={s.color} />)}
        </g>)}</g>
        {hx != null && <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={m.t + ih} className="plot-cross" />}
        {hx != null && readout.map((r, i) => <circle key={i} cx={sx(hx)} cy={clampY(sy(r.v))} r={4} fill={r.s.color} stroke="#fff" />)}
        <T tex={x.label} x={m.l} y={H - 26} width={iw} height={24} className="plot-axl" />
        <g transform={`translate(2, ${m.t + ih}) rotate(-90)`}><T tex={y.label} x={0} y={0} width={ih} height={24} className="plot-axl" /></g>
      </svg>
      <div className="plot-legend">
        {data.filter(s => s.label).map((s, i) => <span key={i}><svg width="28" height="10"><line x1="0" x2="28" y1="5" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={DASH[s.dash || "solid"]} /></svg>
          <span dangerouslySetInnerHTML={{ __html: renderTex(s.label) }} /></span>)}
        {hx != null && <span className="plot-read" dangerouslySetInnerHTML={{ __html: renderTex(`x=${fmt(hx, false)}` + readout.map(r => `,\\ ${r.s.label ? r.s.label.replace(/\\,|\\ /g, "") : "y"}=${fmt(r.v, false)}`).join("")) }} />}
      </div>
      {caption && <div className="plot-cap"><Rich>{caption}</Rich></div>}
    </div>);
}

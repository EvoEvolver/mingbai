import { useState } from "react";
import { useReveal } from "./core.jsx";

// 构建自定义可视化用的基础件。

// 提示框。tone: info | warn | key | quote
export const Callout = ({ tone = "info", title, children }) => (
  <div className={"callout " + tone}>{title && <b>{title}</b>}<div>{children}</div></div>);

// 白底卡片
export const Card = ({ children, style, className = "", onClick }) => (
  <div className={"card " + className} style={style} onClick={onClick}>{children}</div>);

// 自适应网格
export const Grid = ({ min = 240, gap = 16, children }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))`, gap }}>{children}</div>);

// 进入视口时淡入上移
export function Reveal({ children, delay = 0 }) {
  const [ref, vis] = useReveal(.3);
  return <div ref={ref} className={"reveal" + (vis ? " vis" : "")} style={{ transitionDelay: delay + "ms" }}>{children}</div>;
}

// 标签页。tabs: [{label, content}]
export function Tabs({ tabs }) {
  const [i, setI] = useState(0);
  return <div className="card">
    <div className="tabs">{tabs.map((t, j) => <button key={j} className={i === j ? "on" : ""} onClick={() => setI(j)}>{t.label}</button>)}</div>
    <div className="tabpane">{tabs[i].content}</div>
  </div>;
}

// 分步讲解器：上一步/下一步走过一个过程。steps: [{label, content}]
// render(i) 可选：在步骤内容上方渲染随步骤变化的图（如 SVG），i 为当前步。
export function StepThrough({ steps, render }) {
  const [i, setI] = useState(0);
  return <div className="card stepthrough">
    {render && <div className="st-visual">{render(i)}</div>}
    <div className="st-dots">{steps.map((s, j) => <button key={j} className={j === i ? "on" : j < i ? "done" : ""} onClick={() => setI(j)}>{j + 1}. {s.label}</button>)}</div>
    <div className="st-body">{steps[i].content}</div>
    <div className="st-ctrl">
      <button disabled={i === 0} onClick={() => setI(i - 1)}>← 上一步</button>
      <span>{i + 1} / {steps.length}</span>
      <button disabled={i === steps.length - 1} onClick={() => setI(i + 1)}>下一步 →</button>
    </div>
  </div>;
}

// 两态切换（如 古典 ⇄ 现代），children(state) 渲染内容
export function Toggle({ options, children }) {
  const [v, setV] = useState(0);
  return <div className="card">
    <div className="seg">{options.map((o, j) => <button key={j} className={v === j ? "on" : ""} onClick={() => setV(j)}>{o}</button>)}</div>
    <div className="seg-body">{children(v)}</div>
  </div>;
}

// 横向时间轴。events: [{year, label, note}]；点击查看说明
export function Timeline({ events }) {
  const [i, setI] = useState(null);
  return <div className="card">
    <div className="tl">{events.map((e, j) =>
      <button key={j} className={"tl-ev" + (i === j ? " on" : "")} onClick={() => setI(i === j ? null : j)}>
        <span className="tl-y">{e.year}</span><span className="tl-dot" /><span className="tl-l">{e.label}</span>
      </button>)}</div>
    {i !== null && events[i].note && <div className="tl-note">{events[i].note}</div>}
  </div>;
}
